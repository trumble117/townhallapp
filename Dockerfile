# Lightweight nginx image to serve static files
FROM nginx:alpine

# Copy app files into the default nginx web root
COPY ./ /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
