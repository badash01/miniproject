FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
COPY scripts ./scripts
COPY tests ./tests
RUN npm test && npm run download-model
COPY server.js index.html app.js styles.css ./
RUN mkdir -p /var/data && chown -R node:node /app /var/data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 RAG_DATA_DIR=/var/data/rag
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
