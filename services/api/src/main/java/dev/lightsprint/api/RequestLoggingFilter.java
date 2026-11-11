package dev.lightsprint.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
  private static final Logger LOG = LoggerFactory.getLogger(RequestLoggingFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String requestId = UUID.randomUUID().toString();
    long started = System.nanoTime();
    MDC.put("requestId", requestId);
    response.setHeader("X-Request-Id", requestId);
    try {
      chain.doFilter(request, response);
    } finally {
      LOG.info(
          "HTTP request completed: method={}, status={}, durationMs={}",
          request.getMethod(),
          response.getStatus(),
          TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
      MDC.remove("requestId");
    }
  }
}
