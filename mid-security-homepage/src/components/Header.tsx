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
