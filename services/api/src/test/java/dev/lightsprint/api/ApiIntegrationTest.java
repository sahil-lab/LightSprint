package dev.lightsprint.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private JdbcClient jdbc;

  @Test
  void reportsPersistedBootstrapSchemaAfterOneSuccessfulMigration() throws Exception {
    assertThat(
            jdbc.sql("SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success")
                .query(Integer.class)
                .single())
        .isEqualTo(1);
    assertThat(jdbc.sql("SELECT current_database()").query(String.class).single())
        .isEqualTo("lightsprint_test");
    mvc.perform(get("/api/v1/system"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.application").value("lightsprint"))
        .andExpect(jsonPath("$.storage").value("postgresql"))
        .andExpect(jsonPath("$.schemaVersion").value(1))
        .andExpect(jsonPath("$.mode").value("validation-only"));
  }

  @Test
  void exposesOnlySanitizedReadinessAndLiveness() throws Exception {
    for (String group : new String[] {"readiness", "liveness"}) {
      mvc.perform(get("/actuator/health/" + group))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.status").value("UP"))
          .andExpect(jsonPath("$.components").doesNotExist());
    }
    mvc.perform(get("/actuator/env")).andExpect(status().isNotFound());
  }

  @ParameterizedTest
  @ValueSource(strings = {"/projects", "/plans", "/tasks/synthetic/run", "/merges"})
  void doesNotExposeLaterPhaseExecutionOrMutationRoutes(String path) throws Exception {
    mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isNotFound());
  }
}
