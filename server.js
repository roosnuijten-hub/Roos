require('dotenv').config();

const path = require('path');
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const Anthropic = require('@anthropic-ai/sdk');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const app = express();
const port = process.env.PORT || 3000;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  console.warn('Warning: ANTHROPIC_API_KEY is not set in .env');
}

const anthropic = new Anthropic({ apiKey: anthropicApiKey });

const AnalyseResultSchema = z.object({
  summary: z.string(),
  focusPoints: z.array(z.string()).min(5).max(10),
  companies: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      url: z.string(),
    }),
  ),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed.'));
    }
    cb(null, true);
  },
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/analyseer', (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file received.' });
    }

    try {
      const response = await anthropic.messages.parse({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
        output_config: { format: zodOutputFormat(AnalyseResultSchema) },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: req.file.buffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: [
                  'This document describes an invention (for example a patent or patent application).',
                  '1. Summarize the core invention in 2-3 sentences.',
                  '2. List 5 to 10 short phrases (a few words each) capturing the core technical concepts or keywords you used to guide your search for similar companies. Return these as focusPoints.',
                  '3. Use the web_search tool to find 3 to 5 real, currently active startups or scale-ups working on similar technology. For each company, give the name, a one-line description, and the URL.',
                  'Write your response in English.',
                ].join('\n'),
              },
            ],
          },
        ],
      });

      if (!response.parsed_output) {
        return res.status(502).json({ error: 'Could not process the analysis result.' });
      }

      res.json(response.parsed_output);
    } catch (apiErr) {
      if (apiErr instanceof Anthropic.AuthenticationError) {
        console.error('Anthropic authentication error:', apiErr.message);
        return res.status(500).json({ error: 'Invalid ANTHROPIC_API_KEY.' });
      }
      if (apiErr instanceof Anthropic.RateLimitError) {
        console.error('Anthropic rate limit:', apiErr.message);
        return res.status(503).json({ error: 'Rate limit reached, please try again later.' });
      }
      if (apiErr instanceof Anthropic.APIError) {
        console.error('Anthropic API error:', apiErr.message);
        return res.status(502).json({ error: 'Analysis via the Anthropic API failed.' });
      }
      console.error('Unexpected error during analysis:', apiErr);
      res.status(500).json({ error: 'Unexpected error during analysis.' });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
