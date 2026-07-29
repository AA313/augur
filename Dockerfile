# AUGUR — zero-dependency Node backend + static site.
# Pinned to Node 24 because the app uses the built-in node:sqlite (needs Node >= 23.4, flagless).
FROM node:24-slim

WORKDIR /app
COPY . .

# The server reads process.env.PORT (hosts set this). 8080 is a sane default.
ENV PORT=8080
EXPOSE 8080

# No install step: the app has no dependencies.
CMD ["node", "server/server.mjs"]
