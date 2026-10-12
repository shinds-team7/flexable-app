# 로컬에서 만든 app.jar를 실행만 한다(t3.micro에서 Gradle 빌드를 피하기 위함).
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 app
WORKDIR /app
COPY app.jar app.jar
USER app
ENV JAVA_OPTS="-Xms128m -Xmx448m -XX:+UseSerialGC -XX:MaxMetaspaceSize=160m -Duser.timezone=UTC"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
