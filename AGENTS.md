## Project Summary
"StegAnalyzer" is a professional-grade Steganalysis and Steganography application designed for cybersecurity researchers and forensic analysts. It provides a suite of tools to encode hidden data into images, audio, and text, decode them, and perform advanced statistical detection (Chi-Square, BPCS, RS Steganalysis) to identify potential steganographic content.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Components**: Radix UI / Shadcn UI
- **Visualization**: Recharts

## Architecture
- `src/lib/stego`: Core steganography and steganalysis logic.
- `src/components`: UI components including specialized steganalysis widgets.
- `src/app`: Page routes and layout management.
- `src/hooks`: Custom hooks for file processing and analysis.

## User Preferences
- **Theme**: Clinical White (#ffffff) with Blue accents (#6366f1).
- **Navigation**: Sidebar-based (similar to DocuSeal).
- **Component Style**: Named exports, functional components, minimal client-side state where possible.

## Project Guidelines
- No comments unless requested.
- Ensure all steganography logic is purely client-side for security and privacy.
- Avoid redundancy: Image comparison belongs in the Metrics tab, not the main Analyze view.

## Common Patterns
- Batch processing for forensic analysis.
- Detailed reporting in JSON/PDF formats.
