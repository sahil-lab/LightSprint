package dev.lightsprint.api;

import java.util.Comparator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException exception,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    var problem =
        ProblemDetail.forStatusAndDetail(status, "Correct the highlighted request fields.");
    problem.setTitle("Input validation failed");
    problem.setProperty(
        "errors",
        exception.getBindingResult().getFieldErrors().stream()
            .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
            .sorted(Comparator.comparing(FieldError::field))
            .toList());
    problem.setProperty("requestId", MDC.get("requestId"));
    LOG.info("Rejected specification with invalid fields");
    return handleExceptionInternal(exception, problem, headers, status, request);
  }

  @Override
  protected ResponseEntity<Object> handleHttpMessageNotReadable(
      HttpMessageNotReadableException exception,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    var problem =
        ProblemDetail.forStatusAndDetail(
            status, "Request body must be valid JSON and match the documented schema.");
    problem.setTitle("Invalid JSON request");
    problem.setProperty("requestId", MDC.get("requestId"));
    LOG.info("Rejected malformed or schema-incompatible JSON");
    return handleExceptionInternal(exception, problem, headers, status, request);
  }

  @ExceptionHandler(DataAccessException.class)
  ProblemDetail databaseUnavailable(DataAccessException exception) {
    LOG.error("Database read failed", exception);
    var problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.SERVICE_UNAVAILABLE, "Database is unavailable. Try again shortly.");
    problem.setTitle("Storage unavailable");
    problem.setProperty("requestId", MDC.get("requestId"));
    return problem;
  }

  public record FieldError(String field, String message) {}
}
