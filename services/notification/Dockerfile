FROM node:22-alpine
WORKDIR /app
COPY server.mjs server.test.mjs ./
RUN node --test server.test.mjs
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
