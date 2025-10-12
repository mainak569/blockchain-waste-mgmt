# 🌱 WasteChain - Blockchain Waste Management System

A revolutionary blockchain-based smart waste management platform that connects citizens, contractors, and administrators for efficient, transparent, and sustainable waste collection.

## 🌟 Features

### 🏠 **Modern Landing Page**
- Hero section with compelling value proposition
- Interactive statistics with animated counters
- Features showcase with professional icons
- How it works explanation
- Call-to-action sections

### 👨‍💼 **Admin Dashboard**
- Real-time system monitoring and health checks
- Comprehensive bin management interface
- Critical alerts and emergency protocols
- Activity feed with blockchain transaction logs
- Environmental impact analytics
- User management capabilities
- System performance metrics

### 🚛 **Contractor Hub**
- Route optimization with GPS integration
- Real-time earnings tracking
- Performance metrics and ratings
- Urgent assignment notifications
- Pickup confirmation with blockchain logging
- Weekly performance statistics
- Emergency contact system

### 🌍 **Citizen Portal**
- Nearby smart bin finder with location services
- Eco-rewards points system (gamification)
- Environmental impact tracker
- Issue reporting with point rewards
- Community ranking system
- Rewards marketplace
- Educational recycling resources

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes
- **Blockchain**: Ethereum-compatible smart contracts
- **Database**: JSON-based data store (scalable to PostgreSQL)
- **Icons**: Custom SVG icons and Lucide React
- **Deployment**: Vercel (recommended)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/blockchain-waste-mgmt.git
   cd blockchain-waste-mgmt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Dashboard Access

| Role | URL | Description |
|------|-----|-------------|
| **Citizen** | `/dashboard/citizen` | Find bins, track impact, earn rewards |
| **Contractor** | `/dashboard/contractor` | Manage pickups, track earnings, optimize routes |
| **Admin** | `/dashboard/admin` | System monitoring, user management, analytics |

## 🔧 Development

### Project Structure
```
src/
├── app/                    # Next.js 13+ App Router
│   ├── api/               # Backend API routes
│   ├── dashboard/         # Dashboard pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # UI components (shadcn/ui)
│   ├── BinCard.tsx       # Smart bin display card
│   ├── DashboardLayout.tsx # Shared dashboard layout
│   ├── Navigation.tsx    # Site navigation
│   └── DashboardComponents.tsx # Dashboard widgets
└── lib/                  # Utility libraries
    ├── bins.ts           # Bin data and types
    ├── blockchain.ts     # Blockchain utilities
    └── utils.ts          # Helper functions
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🌱 Environmental Impact

WasteChain helps reduce environmental impact through:

- **Smart Routing**: AI-optimized collection routes reduce fuel consumption
- **Real-time Monitoring**: Prevents overflow and contamination
- **Citizen Engagement**: Gamification encourages proper disposal
- **Transparency**: Blockchain ensures accountability
- **Data Analytics**: Insights for better resource allocation

## 🔒 Blockchain Features

- **Immutable Records**: All waste collection activities recorded on blockchain
- **Smart Contracts**: Automated reward distribution and payments
- **Transparency**: Public ledger of all transactions
- **Decentralized**: No single point of failure
- **Tokenization**: Eco-reward tokens for citizen incentives

## 📊 Key Metrics (Demo Data)

- 📍 **247** Smart Bins Monitored
- ♻️ **1,250kg** Waste Collected
- 🌱 **340kg** CO₂ Emissions Saved  
- 🔗 **8,947** Blockchain Transactions
- 👥 **1,500+** Active Citizens
- 🚛 **50+** Registered Contractors

## 🎨 Design System

Built with modern design principles:
- **Responsive**: Mobile-first approach
- **Accessible**: WCAG 2.1 compliant
- **Professional**: Clean, modern interface
- **Intuitive**: User-centered design
- **Consistent**: Design system with reusable components

## 🌟 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy automatically with every push

### Manual Deployment
```bash
npm run build
npm run start
```

## 📞 Support

For support and questions:
- 📧 Email: 23ucc569@lnmiit.ac.in
- 🐛 Issues: [GitHub Issues](https://github.com/mainak569/blockchain-waste-mgmt/issues)

---

**Made with Next.js 15 + Blockchain Technology** 🚀

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mainak569/blockchain-waste-mgmt)
