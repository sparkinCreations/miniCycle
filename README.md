# miniCycle

**Turn Your Routine Into Progress**

A free, privacy-first task management app with a unique automatic cycling feature that helps you build consistent habits and maintain productive routines.

---

## 🌟 Features

- ✅ **Automatic Task Cycling** – Tasks reset when completed, promoting habit formation
- 🔁 **Recurring Tasks** – Schedule tasks to repeat on your preferred intervals
- 📱 **Progressive Web App** – Install on any device, works offline
- 🎨 **Unlockable Themes** – Earn new themes by completing cycles
- 🏆 **Milestones & Badges** – Gamification to keep you motivated
- 🔒 **Privacy-First** – All data stored locally, no accounts required
- ⚡ **Lightweight** – Fast, responsive, and works on any device

---

## 🚀 Quick Start

### Try Online
Visit **[minicycle.app](https://minicycle.app)** to start using miniCycle instantly.

### Install as App
1. Visit [minicycle.app](https://minicycle.app) on your device
2. Look for "Install App" or "Add to Home Screen" option
3. Enjoy miniCycle as a native-like app!

---

## 🔧 Development

### Project Structure
```
miniCycle/
├── web/                  # Web application
│   ├── miniCycle.html    # Main app entry point
│   ├── miniCycle-lite.html # ES5 compatible version
│   ├── miniCycle-scripts.js # Core application logic
│   ├── miniCycle-styles.css # Application styles
│   ├── manifest.json     # PWA configuration
│   └── service-worker.js # Offline functionality
├── docs/                 # Documentation
└── README.md            # This file
```

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/sparkinCreations/miniCycle.git
   cd miniCycle
   ```

2. Serve the web folder:
   ```bash
   # Using Python
   cd web && python -m http.server 8000
   
   # Using Node.js
   npx serve web
   
   # Using PHP
   cd web && php -S localhost:8000
   ```

3. Open `http://localhost:8000` in your browser

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (ES6+ version)
- **Legacy Support**: Automatic fallback to ES5 version for older browsers
- **Mobile**: Full support for iOS Safari and Android Chrome

---

## 🎯 How It Works

1. **Add Tasks**: Create your routine tasks
2. **Complete Tasks**: Check off tasks as you finish them
3. **Auto-Cycle**: When all tasks are done, they automatically reset
4. **Build Habits**: The cycling system encourages consistent routines
5. **Earn Rewards**: Unlock themes and badges as you progress


---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly across browsers
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏢 About sparkinCreations

miniCycle is developed by [sparkinCreations](https://sparkincreations.com), dedicated to creating productivity tools that actually help people build better habits.

- **Website**: [sparkincreations.com](https://sparkincreations.com)
- **Support**: Open an issue or contact us
- **TaskCycle Pro**: [taskcycle.app](https://taskcycle.app)

---

## 🌟 Star This Project

If miniCycle helps improve your productivity, please give us a star! It helps others discover the project.

[⭐ Star on GitHub](https://github.com/sparkinCreations/miniCycle)
