# docker build -t streamy_node .
FROM node:13.5.0

# Use a pre-existing folder/usr/src/app 
WORKDIR /usr/src/app

# Copy only package files first and install node dependencies 
COPY package*.json ./
RUN npm install

# Copy streamy code
COPY . .

CMD [ "npm", "start" ]
