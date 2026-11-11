package dev.lightsprint.api;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemController {
  private final JdbcClient jdbc;

  public SystemController(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/v1/system")
  public SystemStatus status() {
    int schemaVersion =
        jdbc.sql("SELECT schema_version FROM app_metadata WHERE id = 1")
            .query(Integer.class)
            .single();
    return new SystemStatus(
        "lightsprint", 1, "ready", "postgresql", schemaVersion, "validation-only");
  }

  public record SystemStatus(
      String application,
      int phase,
      String status,
      String storage,
      int schemaVersion,
      String mode) {}
}
