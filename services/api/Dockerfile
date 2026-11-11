FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/lightsprint-api-0.1.0.jar /app/app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
