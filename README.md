# LiveQuestionTime

A live Q&A platform for podcast hosts where audience members pay micropayments to submit questions. Built with Open Payments and Interledger.

![LiveQuestionTime](https://img.shields.io/badge/Powered%20by-Open%20Payments-ff2d92)
![Interledger](https://img.shields.io/badge/Built%20on-Interledger-00f5ff)

## Features

- 🎙️ **Host Dashboard** - Create and manage live Q&A sessions
- 💰 **Micropayments** - Accept questions for as low as $0.01
- 📺 **Video Stream Integration** - Embed YouTube, Twitch, or any streaming platform
- 📋 **Question Queue** - Real-time question management with upvoting
- 💳 **Direct Payments** - Payments go straight to your Open Payments wallet
- 🌍 **Global Reach** - Accept payments from anywhere via Interledger

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **State Management**: Zustand
- **Payments**: Open Payments SDK (`@interledger/open-payments`)

## Getting Started

### Prerequisites

- Node.js 18+ 
- An Open Payments-enabled wallet (e.g., from [Rafiki](https://rafiki.dev) or compatible ASE)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/livequestiontime.git
cd livequestiontime

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Usage

### For Hosts

1. Go to the **Host Dashboard** (`/host`)
2. Click **New Session** to create a Q&A session
3. Enter your:
   - Session title and description
   - Open Payments wallet address (e.g., `$wallet.example/yourname`)
   - Price per question (as low as $0.01)
   - Optional: Live stream URL
4. Click **Go Live** to start accepting questions
5. Share the viewer link with your audience
6. Manage incoming questions from the dashboard

### For Viewers

1. Open the viewer link shared by the host
2. Watch the live stream (if embedded)
3. Enter your name and question
4. Pay the small fee via Open Payments
5. See your question appear in the queue
6. Upvote other questions you want answered

## Open Payments Integration

This app uses the [Open Payments API](https://openpayments.dev) to handle micropayments. The flow works as follows:

1. **Host Setup**: Host provides their wallet address when creating a session
2. **Payment Creation**: When a viewer submits a question, an incoming payment is created on the host's wallet
3. **Payment Completion**: The viewer authorizes the payment from their wallet
4. **Question Submission**: Once payment is confirmed, the question appears in the queue

### Demo Mode

The current implementation includes a simulated payment flow for demonstration purposes. In production, you would:

1. Initialize an authenticated Open Payments client with your keys
2. Implement proper GNAP grant flows
3. Handle webhooks for payment confirmation
4. Store payment records in a database

## Project Structure

```
├── app/
│   ├── page.tsx              # Landing page
│   ├── host/
│   │   ├── page.tsx          # Host dashboard
│   │   ├── new/page.tsx      # Create session
│   │   └── session/[id]/     # Session management
│   └── watch/[id]/page.tsx   # Viewer page
├── components/
│   ├── ui/                   # Reusable UI components
│   ├── host/                 # Host-specific components
│   └── viewer/               # Viewer-specific components
├── lib/
│   ├── store.ts              # Zustand state management
│   ├── types.ts              # TypeScript types
│   ├── utils.ts              # Utility functions
│   └── open-payments.ts      # Open Payments integration
└── ...config files
```

## Environment Variables

For production deployment, you'll need:

```env
# Your Open Payments client credentials
OPEN_PAYMENTS_KEY_ID=your-key-id
OPEN_PAYMENTS_PRIVATE_KEY=your-private-key
OPEN_PAYMENTS_WALLET_ADDRESS=https://wallet.example/your-client

# Database (if using persistent storage)
DATABASE_URL=your-database-url

# LiveKit real-time video
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
NEXT_PUBLIC_LIVEKIT_WS_URL=wss://your-livekit-host
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Resources

- [Open Payments Documentation](https://openpayments.dev/overview/getting-started/)
- [Interledger Foundation](https://interledger.org)
- [Rafiki - Open Payments Reference Implementation](https://rafiki.dev)
- [Open Payments SDK](https://www.npmjs.com/package/@interledger/open-payments)

---

Built with ❤️ for the Interledger community
