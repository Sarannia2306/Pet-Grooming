# SnugglePaw - Pet Grooming Services

A modern, responsive website for SnugglePaw Pet Grooming Services, featuring a clean design and smooth user experience.

## Features

- Responsive design that works on all devices
- Modern UI with smooth animations
- Form validation for better user experience
- Optimized performance with code splitting
- Service worker for offline support (PWA)
- SEO optimized

## Project Structure

```
Snuggle-Paw/
├── css/                    # CSS files
│   ├── pages/             # Page-specific styles
│   │   ├── about.css
│   │   ├── contact.css
│   │   ├── dashboard.css
│   │   ├── login.css
│   │   └── register.css
│   └── style.css          # Global styles
├── js/                    # JavaScript files
│   ├── modules/           # JavaScript modules
│   │   ├── animations.js  # Scroll and animation effects
│   │   ├── form-validation.js  # Form validation logic
│   │   ├── navigation.js  # Navigation functionality
│   │   └── ui-effects.js  # UI interactions and effects
│   ├── utils/             # Utility functions
│   │   └── script-loader.js
│   └── main.js            # Main entry point
├── assets/                # Images, fonts, and other assets
├── index.html             # Home page
├── about.html             # About us page
├── services.html          # Services page
├── contact.html           # Contact page
├── login.html             # Login page
├── register.html          # Registration page
├── dashboard.html         # User dashboard
├── booking.html           # Booking page
├── package.json           # Project dependencies
└── webpack.config.js      # Webpack configuration
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher) or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Snuggle-Paw.git
   cd Snuggle-Paw
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

### Development

To start the development server with live reload:

```bash
npm start
# or
yarn start
```

This will start a local development server at `http://localhost:3000`.

### Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The production-ready files will be in the `dist` directory.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (latest)

## Technologies Used

- HTML5
- CSS3 (with CSS Variables)
- JavaScript (ES6+)
- [Animate.css](https://animate.style/) for animations
- [Font Awesome](https://fontawesome.com/) for icons
- Webpack for module bundling
- Babel for JavaScript transpilation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Animate.css](https://animate.style/)
- [Font Awesome](https://fontawesome.com/)
- [Google Fonts](https://fonts.google.com/)
- [Unsplash](https://unsplash.com/) for placeholder images
