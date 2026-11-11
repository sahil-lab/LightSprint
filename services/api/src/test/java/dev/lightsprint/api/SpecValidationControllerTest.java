package dev.lightsprint.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SpecValidationController.class)
@Import(JsonConfiguration.class)
class SpecValidationControllerTest {
  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;

  @Test
  void validatesSyntheticInputWithoutCreatingAResource() throws Exception {
    mvc.perform(
            post("/api/v1/intake/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of(
                            "title",
                            "Synthetic dashboard",
                            "acceptanceCriteria",
                            List.of("Status is visible", "Errors are explicit")))))
        .andExpect(status().isOk())
        .andExpect(header().exists("X-Request-Id"))
        .andExpect(header().doesNotExist("Location"))
        .andExpect(jsonPath("$.valid").value(true))
        .andExpect(jsonPath("$.mode").value("validation-only"))
        .andExpect(jsonPath("$.criterionCount").value(2));
  }

  @Test
  void rejectsBlankTitleAndMissingCriteriaWithFieldErrors() throws Exception {
    mvc.perform(
            post("/api/v1/intake/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"  \",\"acceptanceCriteria\":[]}"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.errors[*].field", hasItems("title", "acceptanceCriteria")))
        .andExpect(jsonPath("$.requestId").isString());
  }

  @Test
  void rejectsOversizedAndBlankNestedValues() throws Exception {
    for (var criteria :
        List.of(List.of(" "), List.of("x".repeat(241)), Collections.nCopies(11, "x"))) {
      mvc.perform(
              post("/api/v1/intake/validate")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(
                      json.writeValueAsString(
                          Map.of("title", "x".repeat(81), "acceptanceCriteria", criteria))))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.errors[*].field", hasItems("title")))
          .andExpect(content().string(containsString("acceptanceCriteria")));
    }
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{",
        "null",
        "{\"title\":\"Synthetic\",\"acceptanceCriteria\":[\"x\"],\"unexpected\":\"DO-NOT-ECHO\"}",
        "{\"title\":42,\"acceptanceCriteria\":[\"x\"]}",
        "{\"title\":\"Synthetic\",\"acceptanceCriteria\":[true]}",
        "{\"title\":\"Synthetic\",\"acceptanceCriteria\":[\"x\"]} {}"
      })
  void rejectsMalformedUnknownAndCoercedJsonWithoutEchoingValues(String body) throws Exception {
    mvc.perform(
            post("/api/v1/intake/validate").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("Invalid JSON request"))
        .andExpect(
            jsonPath("$.detail")
                .value("Request body must be valid JSON and match the documented schema."))
        .andExpect(content().string(not(containsString("DO-NOT-ECHO"))))
        .andExpect(jsonPath("$.trace").doesNotExist());
  }
}
