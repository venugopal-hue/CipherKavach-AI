# CipherKavach AI - Vulnerability Scanner MVP

CipherKavach AI is a simple, beginner-friendly cybersecurity vulnerability scanner built for hackathons. It analyzes your `package.json` dependencies against known vulnerabilities via OSV.dev and provides AI-powered explanations and remediation suggestions.

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Framer Motion
- OpenAI API

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file in the root directory and add your OpenAI API key (optional, will fall back to default descriptions without it):
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open the Application**
   Navigate to [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage Flow
1. Upload your project's `package.json` file.
2. The Next.js API route will parse your dependencies automatically.
3. Vulnerabilities are cross-referenced with the OSV.dev API.
4. If an OpenAI API key is provided, the platform will use AI to break down the vulnerabilities in beginner-friendly language and suggest precise fixes.
