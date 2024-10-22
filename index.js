require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const mongoClient = require('mongodb').MongoClient;

const app = express();
const port = process.env.PORT || 3000;

// Basic Configuration
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;
let db;

mongoClient.connect(mongoUri)
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db('urlShortener');

    // Test the connection by counting documents
    db.collection('urls').countDocuments()
      .then(count => {
        console.log(`Document count in urls collection: ${count}`);
        app.listen(port, function () {
          console.log(`Listening on port ${port}`);
        });
      })
      .catch(err => {
        console.error('Error counting documents:', err);
      });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// POST endpoint to shorten URLs
app.post('/api/shorturl', async function (req, res) {
  const originalUrl = req.body.url;
  console.log('Received URL:', originalUrl);

  const urlRegex = /^(https?:\/\/)(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/;
  if (!urlRegex.test(originalUrl)) {
    console.log('Invalid URL format');
    return res.json({ error: 'invalid url' });
  }

  const hostname = new URL(originalUrl).hostname;
  console.log('Performing DNS lookup for:', hostname);

  try {
    await dns.promises.lookup(hostname);
    console.log('DNS lookup successful, querying database');

    const urlDoc = await db.collection('urls').findOne({ original_url: originalUrl });
    if (urlDoc) {
      console.log('URL found in database:', urlDoc);
      return res.json({ original_url: urlDoc.original_url, short_url: urlDoc.short_url });
    }

    const shortUrl = Math.floor(Math.random() * 100000);
    const newUrl = { original_url: originalUrl, short_url: shortUrl };

    console.log('Inserting new URL into database:', newUrl);
    await db.collection('urls').insertOne(newUrl);
    console.log('URL inserted successfully:', newUrl);
    res.json({ original_url: originalUrl, short_url: shortUrl });
  } catch (err) {
    console.error('Error during processing:', err);
    res.status(500).json({ error: 'An error occurred' });
  }
});




// Redirect to original URL
app.get('/api/shorturl/:shortUrl', async function (req, res) {
  const shortUrl = parseInt(req.params.shortUrl);
  console.log(`Received request to redirect short URL: ${shortUrl}`);

  try {
    const urlDoc = await db.collection('urls').findOne({ short_url: shortUrl });
    if (!urlDoc) {
      console.log(`No URL found for short URL: ${shortUrl}`);
      return res.json({ error: 'No short URL found' });
    }
    console.log(`Redirecting to original URL: ${urlDoc.original_url}`);
    res.redirect(urlDoc.original_url);
  } catch (err) {
    console.error('Error during database query:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});