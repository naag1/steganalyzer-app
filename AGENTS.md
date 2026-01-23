## Project Summary
"Orchid Pro" is a professional-grade Steganalysis and Steganography application designed for cybersecurity researchers and forensic analysts. It provides a suite of tools to encode hidden data into images/text, decode them, and perform advanced statistical detection (Chi-Square, BPCS, RS Steganalysis) to identify potential steganographic content.

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
- **Theme**: Orchid Purple (#9b59b6) and Slate Gray (#2d3436).
- **Navigation**: Sidebar-based (similar to DocuSeal).
- **Component Style**: Named exports, functional components, minimal client-side state where possible.

## Project Guidelines
- No comments unless requested.
- Use Orchid theme consistently.
- Ensure all steganography logic is purely client-side for security and privacy.

## Common Patterns
- Batch processing for forensic analysis.
- Detailed reporting in JSON/PDF formats.
