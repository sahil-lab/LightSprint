package dev.lightsprint.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SpecValidationController {
  @PostMapping("/api/v1/intake/validate")
  public ValidationResult validate(@Valid @RequestBody SpecValidationRequest request) {
    return new ValidationResult(true, "validation-only", request.acceptanceCriteria().size());
  }

  public record SpecValidationRequest(
      @NotBlank @Size(max = 80) String title,
      @NotEmpty @Size(max = 10) List<@NotBlank @Size(max = 240) String> acceptanceCriteria) {}

  public record ValidationResult(boolean valid, String mode, int criterionCount) {}
}
