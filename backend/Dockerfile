FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads/media

# Create volume for uploads persistence
VOLUME ["/app/uploads"]

EXPOSE 3001

CMD ["npm", "start"]
