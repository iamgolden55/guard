import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect for the header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'bg-white shadow-ms-sm' : 'bg-white'}`}>
      <div className="container">
        {/* Top Bar with Contact Info */}
        <div className="py-2 border-b border-ms-gray-200 text-sm flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <a href="tel:07452830021" className="flex items-center text-ms-gray-600 hover:text-primary transition-colors">
              <i className="fas fa-phone mr-2"></i> 07452 830021
            </a>
            <a href="mailto:contactus@meadsecurity.co.uk" className="flex items-center text-ms-gray-600 hover:text-primary transition-colors">
              <i className="fas fa-envelope mr-2"></i> contactus@meadsecurity.co.uk
            </a>
          </div>
          <div className="flex items-center space-x-3">
            <a
              href="https://www.facebook.com/Mead-Security-335205733994020/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-ms-gray-600 hover:text-primary transition-colors"
            >
              <i className="fab fa-facebook-f"></i>
            </a>
            <a
              href="https://www.instagram.com/mead_security/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-ms-gray-600 hover:text-primary transition-colors"
            >
              <i className="fab fa-instagram"></i>
            </a>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <img
              src="https://ext.same-assets.com/759128491/431135145.png"
              alt="Mead Security Logo"
              className="h-12"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink
              to="/"
              className={({isActive}) =>
                isActive
                  ? "px-4 py-2 text-primary border-b-2 border-primary font-medium"
                  : "px-4 py-2 text-ms-gray-700 hover:text-primary border-b-2 border-transparent font-medium"
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/services"
              className={({isActive}) =>
                isActive
                  ? "px-4 py-2 text-primary border-b-2 border-primary font-medium"
                  : "px-4 py-2 text-ms-gray-700 hover:text-primary border-b-2 border-transparent font-medium"
              }
            >
              Services
            </NavLink>
            <NavLink
              to="/about"
              className={({isActive}) =>
                isActive
                  ? "px-4 py-2 text-primary border-b-2 border-primary font-medium"
                  : "px-4 py-2 text-ms-gray-700 hover:text-primary border-b-2 border-transparent font-medium"
              }
            >
              About Us
            </NavLink>
            <NavLink
              to="/contact"
              className={({isActive}) =>
                isActive
                  ? "px-4 py-2 text-primary border-b-2 border-primary font-medium"
                  : "px-4 py-2 text-ms-gray-700 hover:text-primary border-b-2 border-transparent font-medium"
              }
            >
              Contact Us
            </NavLink>
            <a
              href="https://same-rqmlmf5nx6q-latest.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="ms-btn ml-3"
            >
              Staff Portal
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="p-2 text-ms-gray-700 hover:text-primary focus:outline-none"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-ms-gray-200 bg-white">
            <div className="flex flex-col">
              <NavLink
                to="/"
                className={({isActive}) =>
                  isActive
                    ? "py-3 px-4 text-primary border-l-4 border-primary bg-ms-gray-50"
                    : "py-3 px-4 text-ms-gray-700 hover:text-primary hover:bg-ms-gray-50 border-l-4 border-transparent"
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </NavLink>
              <NavLink
                to="/services"
                className={({isActive}) =>
                  isActive
                    ? "py-3 px-4 text-primary border-l-4 border-primary bg-ms-gray-50"
                    : "py-3 px-4 text-ms-gray-700 hover:text-primary hover:bg-ms-gray-50 border-l-4 border-transparent"
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Services
              </NavLink>
              <NavLink
                to="/about"
                className={({isActive}) =>
                  isActive
                    ? "py-3 px-4 text-primary border-l-4 border-primary bg-ms-gray-50"
                    : "py-3 px-4 text-ms-gray-700 hover:text-primary hover:bg-ms-gray-50 border-l-4 border-transparent"
                }
                onClick={() => setIsMenuOpen(false)}
              >
                About Us
              </NavLink>
              <NavLink
                to="/contact"
                className={({isActive}) =>
                  isActive
                    ? "py-3 px-4 text-primary border-l-4 border-primary bg-ms-gray-50"
                    : "py-3 px-4 text-ms-gray-700 hover:text-primary hover:bg-ms-gray-50 border-l-4 border-transparent"
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Contact Us
              </NavLink>
              <a
                href="https://same-rqmlmf5nx6q-latest.netlify.app"
                target="_blank"
                rel="noopener noreferrer"
                className="ms-btn m-4 text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Staff Portal
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
