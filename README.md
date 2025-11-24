      # Town Hall Question Display App

A lightweight web application for displaying audience questions from a Google Sheets document at town hall meetings.

## Features

- Fetches questions from a publicly shared Google Sheets CSV export URL
- Displays questions in modern, rounded-corner boxes with previews
- Click on a question box to view the full question with submitter's name
- Configurable polling interval for automatic updates
- Responsive design with modern styling

## Prerequisites

- A web browser (Chrome, Firefox, Safari, etc.)
- A publicly shared Google Sheets document with questions

## Setup Google Sheets

1. Create a new Google Sheets document or use an existing one.
2. Add two columns: `Name` (or similar for submitter) and `Question`.
3. Enter your data with submitter names in the first column and questions in the second.
4. Share the sheet publicly: Click "Share" > "Get shareable link" > Set to "Anyone with the link can view".
5. Get the CSV export URL:
   - Replace `/edit?usp=sharing` in the shareable link with `/export?format=csv`
   - Example: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv`

**Important:** The CSV must have a header row, and each subsequent row should contain the submitter's name followed by the question, separated by commas. Avoid using commas within the name or question text to prevent parsing issues.

## Configuration

1. Access the application in your web browser.
2. Click the settings button (⚙️) in the top-right corner.
3. Enter the Google Sheets CSV URL in the "Google Sheets CSV URL" field.
4. Set the desired poll interval in seconds (minimum 5 seconds).
5. Click "Save" to apply the settings.

Settings are saved locally in your browser and will persist between sessions.

## Running the App

**Important:** Due to browser security policies (CORS), you cannot open `index.html` directly from the file system in your browser. You must serve the files using a local web server.

### Quick Start with Python (Recommended)

If you have Python installed (most systems do):

1. Open a terminal in the app directory.
2. Run: `python -m http.server 8000`
3. Open `http://localhost:8000` in your web browser.

The app will automatically start polling for new questions based on your configuration.

### Alternative: Node.js

If you have Node.js installed:

1. Install a simple server: `npm install -g http-server`
2. In the app directory: `http-server`
3. Open the provided localhost URL in your browser.

## Deployment

Since this is a static web application, you can deploy it in several ways:

### Local Deployment

1. Place the files (`index.html`, `styles.css`, `app.js`) in a folder on your laptop.
2. Serve the files using a local web server (see "Running the App" section above).

### Web Server Deployment

For a more robust setup, serve the files using a local web server:

#### Using Python (if installed)
```bash
cd /path/to/your/app
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

#### Using Node.js (if installed)
```bash
npm install -g http-server
cd /path/to/your/app
http-server
```
Then open the provided localhost URL in your browser.

### Hosting on a Web Server

Upload the three files to any static web hosting service (GitHub Pages, Netlify, Vercel, etc.).

## Usage

- The main screen displays question previews in grid layout.
- Click on any question box to expand it and read the full question.
- Use the settings button to update the data source or polling frequency.
- The app automatically refreshes questions based on the configured interval.

## Troubleshooting

- **Questions not loading:** Ensure the Google Sheets CSV URL is correct and the sheet is publicly shared.
- **Parsing errors:** Make sure the CSV format is correct (Name,Question) and contains no extra commas in the text.
- **Styling issues:** Ensure all three files (`index.html`, `styles.css`, `app.js`) are in the same directory.

## Security Note

This app uses unauthenticated access to the Google Sheets CSV export. Ensure your sheet only contains non-sensitive information and is shared appropriately.

## License

This project is open-source and available under the MIT License.
