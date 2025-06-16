import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-ms-gray-900 text-white">
      {/* Main Footer */}
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* About Section */}
          <div>
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <div className="w-1 h-5 bg-primary mr-3"></div>
              About Us
            </h3>
            <div className="mb-6">
              <img
                src="/logos/MeadLogowhite.png"
                alt="Mead Security Logo"
                className="h-12"
              />
            </div>
            <p className="text-ms-gray-300 mb-6 leading-relaxed">
              Mead Security provides professional security services across Bristol and throughout the South West.
              We are dedicated to providing cost effective security solutions delivered by fully SIA licensed and experienced personnel.
            </p>
            <div className="flex space-x-2">
            <img src="/logos/SIA+Approved-80h.webp" alt="SIA Approved Logo" className="h-12 sm:h-16 object-contain" />
              <a
                href="https://www.instagram.com/mead_security/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-ms-gray-800 hover:bg-primary w-10 h-10 rounded-ms flex items-center justify-center transition-colors duration-200"
                aria-label="Instagram"
              >
                <i className="fab fa-instagram"></i>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <div className="w-1 h-5 bg-primary mr-3"></div>
              Quick Links
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Home
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Services
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="https://same-rqmlmf5nx6q-latest.netlify.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center"
                >
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Staff Portal
                </a>
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-8 mb-6 flex items-center">
              <div className="w-1 h-5 bg-primary mr-3"></div>
              Our Services
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/services#door-supervisor" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Door Supervisor
                </Link>
              </li>
              <li>
                <Link to="/services#static-guard" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Static Guard
                </Link>
              </li>
              <li>
                <Link to="/services#concierge" className="text-ms-gray-300 hover:text-primary transition-colors duration-200 flex items-center">
                  <i className="fas fa-chevron-right text-xs mr-3 text-primary"></i> Concierge
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <div className="w-1 h-5 bg-primary mr-3"></div>
              Contact Us
            </h3>
            <ul className="space-y-4">
              <li className="text-ms-gray-300 flex items-start">
                <i className="fas fa-map-marker-alt mt-1 mr-3 text-primary"></i>
                <span>Bristol & Southwest, United Kingdom</span>
              </li>
              <li className="text-ms-gray-300 flex items-center">
                <i className="fas fa-phone mr-3 text-primary"></i>
                <a href="tel:07452830021" className="hover:text-primary transition-colors duration-200">07452 830021</a>
              </li>
              <li className="text-ms-gray-300 flex items-center">
                <i className="fas fa-envelope mr-3 text-primary"></i>
                <a href="mailto:contactus@meadsecurity.co.uk" className="hover:text-primary transition-colors duration-200">contactus@meadsecurity.co.uk</a>
              </li>
            </ul>
            <div className="mt-8">
              <h4 className="text-lg font-medium mb-4">Get in Touch</h4>
              <Link to="/contact" className="ms-btn w-full text-center">
                Request a Call Back
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-ms-gray-800">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-ms-gray-400 text-sm">
              &copy; {currentYear} Mead Security - All Rights Reserved
            </p>
            <p className="text-ms-gray-400 text-sm mt-2 md:mt-0">
              Website designed with <span className="text-primary">♥</span> by Mead Security
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
