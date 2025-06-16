import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import HoverAnimation from '../components/animations/HoverAnimation';
import { useState, useEffect } from 'react';


const HomePage = () => {
  // Testimonials data
  const testimonials = [
    {
      quote: "Mead Security's door supervisors have been excellent for our venue. Professional, friendly and always vigilant. They're now an integral part of our operation.",
      author: "Michael Thompson",
      role: "Operations Manager",
      company: "Venue Bristol",
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
    },
    {
      quote: "We've used Mead Security for three years running at our annual festival. Their attention to detail and customer service approach makes all the difference.",
      author: "Sarah Williams",
      role: "Events Director",
      company: "Somerset Events",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
    },
    {
      quote: "Reliable, consistent and thorough. The team at Mead Security provides us with peace of mind for all of our high-profile corporate events.",
      author: "James Anderson",
      role: "Facilities Manager",
      company: "ExeCorp Bristol",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
    }
  ];

  // State for current testimonial
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Rotate testimonials every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [testimonials.length]);
  
  // Function to go to next testimonial
  const nextTestimonial = () => {
    setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
  };
  
  // Function to go to previous testimonial
  const prevTestimonial = () => {
    setCurrentTestimonial(prev => (prev - 1 + testimonials.length) % testimonials.length);
  };
  return (
    <>
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center bg-no-repeat min-h-[90vh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.65)), url('https://ext.same-assets.com/764186857/1001001560.jpeg')`
        }}
      >
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Side - Hero Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                ease: [0.25, 0.1, 0.25, 1],
                staggerChildren: 0.1
              }}
            >
              <motion.h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Professional Security Services
              </motion.h1>
              <motion.p
                className="text-lg text-white mb-6 opacity-90"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                Mead Security provides professional security services across Bristol and the South West with over 15 years of experience.
              </motion.p>
              <motion.ul
                className="text-white space-y-3 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mr-3"></div>
                  Bristol and Southwest Security Services
                </li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mr-3"></div>
                  Friendly, Reliable & Professional team
                </li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mr-3"></div>
                  Enquire Today for a FREE Security Quotation
                </li>
              </motion.ul>
              <motion.div
                className="flex flex-wrap gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <HoverAnimation>
                  <Link to="/contact" className="ms-btn">
                    Let's Talk
                  </Link>
                </HoverAnimation>
                <HoverAnimation>
                  <Link to="/about" className="ms-btn-outline border-white text-white">
                    About Us
                  </Link>
                </HoverAnimation>
              </motion.div>
            </motion.div>

            {/* Right Side - Testimonial */}
            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div className="bg-white p-6 rounded-ms-md shadow-ms relative border border-ms-gray-200">
                <div className="absolute -top-5 left-10 bg-primary text-white p-2 rounded-ms-md">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.5 10c-.223 0-.437.034-.65.065.069-.232.14-.468.254-.68.114-.308.292-.575.469-.844.148-.291.409-.488.601-.737.201-.242.475-.403.692-.604.213-.21.492-.315.714-.463.232-.133.434-.28.65-.35.208-.086.39-.16.539-.222.302-.125.474-.197.474-.197L9.758 4.03c0 0-.218.052-.597.144C8.97 4.222 8.737 4.278 8.472 4.345c-.271.05-.56.187-.882.312C7.272 4.799 6.904 4.895 6.562 5.123c-.344.218-.741.4-1.091.692C5.132 6.116 4.723 6.377 4.421 6.76c-.33.358-.656.734-.909 1.162C3.219 8.33 3.02 8.778 2.81 9.221c-.19.443-.343.896-.468 1.336-.237.882-.343 1.72-.384 2.437-.034.718-.014 1.315.028 1.747.015.204.043.402.063.539.017.109.025.168.025.168l.026-.006C2.535 17.474 4.338 19 6.5 19c2.485 0 4.5-2.015 4.5-4.5S8.985 10 6.5 10zM17.5 10c-.223 0-.437.034-.65.065.069-.232.14-.468.254-.68.114-.308.292-.575.469-.844.148-.291.409-.488.601-.737.201-.242.475-.403.692-.604.213-.21.492-.315.714-.463.232-.133.434-.28.65-.35.208-.086.39-.16.539-.222.302-.125.474-.197.474-.197L20.758 4.03c0 0-.218.052-.597.144-.191.048-.424.104-.689.171-.271.05-.56.187-.882.312-.317.143-.686.238-1.028.467-.344.218-.741.4-1.091.692-.339.301-.748.562-1.05.944-.33.358-.656.734-.909 1.162C14.219 8.33 14.02 8.778 13.81 9.221c-.19.443-.343.896-.468 1.336-.237.882-.343 1.72-.384 2.437-.034.718-.014 1.315.028 1.747.015.204.043.402.063.539.017.109.025.168.025.168l.026-.006C13.535 17.474 15.338 19 17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10z" />
                  </svg>
                </div>
              
                <div className="pt-6">
                  <h3 className="text-xl font-semibold mb-3 text-center">What Our Clients Say</h3>
                  
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={currentTestimonial}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <p className="text-ms-gray-700 text-lg leading-relaxed mb-6 italic min-h-[100px]">
                        "{testimonials[currentTestimonial].quote}"
                      </p>
                    
                      <div className="flex items-center">
                        <img
                          src={testimonials[currentTestimonial].image}
                          alt={testimonials[currentTestimonial].author}
                          className="w-14 h-14 rounded-full object-cover border-2 border-ms-gray-200"
                        />
                        <div className="ml-4">
                          <h4 className="font-semibold text-ms-gray-800">{testimonials[currentTestimonial].author}</h4>
                          <p className="text-ms-gray-600 text-sm">
                            {testimonials[currentTestimonial].role}, {testimonials[currentTestimonial].company}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Navigation Controls */}
                  <div className="flex justify-between mt-6">
                    <button 
                      onClick={prevTestimonial} 
                      className="p-2 rounded-full bg-ms-gray-100 hover:bg-ms-gray-200 transition-colors"
                      aria-label="Previous testimonial"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button 
                      onClick={nextTestimonial} 
                      className="p-2 rounded-full bg-ms-gray-100 hover:bg-ms-gray-200 transition-colors"
                      aria-label="Next testimonial"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>








      {/* Clients Logo Slider */}
      <section className="py-16 bg-white border-t border-b border-gray-100">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-3">Trusted by Businesses Across Bristol</h2>
            <p className="text-ms-gray-600 max-w-2xl mx-auto">We're proud to provide security services for these leading local businesses</p>
          </motion.div>
          
          <div className="relative overflow-hidden py-4 bg-white">
            {/* Mobile-optimized logo slider */}
            <motion.div 
              className="flex"
              animate={{ x: [0, -1500] }} 
              transition={{ 
                x: { 
                  repeat: Infinity, 
                  repeatType: "loop", 
                  duration: 30,
                  ease: "linear"
                }
              }}
            >
              {/* All logos in a row with larger sizing */}
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/MeadLogowhite.png" alt="Mead Security Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/BIMM.png" alt="BIMM Music Institute Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/rough-trade.svg" alt="Rough Trade Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/renatos logo.png" alt="Renatos Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/Left_Handed_Giant_Brewery_Logo_white.avif" alt="Left Handed Giant Brewery Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/LOGOMAIN.png" alt="Logo Main" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/SIA+Approved-80h.webp" alt="SIA Approved Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/old_vic.jpg" alt="Old Vic Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/moor.jpg" alt="Moor Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/ostrich.jpg" alt="Ostrich Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/abd1542d-ef4a-4631-a161-1aa10b2115c1-Butcombe Pubs and Inns Logo.png" alt="Butcombe Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/access.avif" alt="Access Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/63456bf0027bd0c200327287_Primary B Blck.svg" alt="Primary B Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>

              
              {/* Duplicate set for continuous looping */}
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/MeadLogowhite.png" alt="Mead Security Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/BIMM.png" alt="BIMM Music Institute Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/rough-trade.svg" alt="Rough Trade Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/renatos logo.png" alt="Renatos Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/Left_Handed_Giant_Brewery_Logo_white.avif" alt="Left Handed Giant Brewery Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/LOGOMAIN.png" alt="Logo Main" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/SIA+Approved-80h.webp" alt="SIA Approved Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/old_vic.jpg" alt="Old Vic Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/moor.jpg" alt="Moor Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/ostrich.jpg" alt="Ostrich Logo" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/abd1542d-ef4a-4631-a161-1aa10b2115c1-Butcombe Pubs and Inns Logo.png" alt="Butcombe Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/Access.avif" alt="Butcombe Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
              <div className="flex-shrink-0 flex items-center justify-center h-20 sm:h-28 w-32 sm:w-40 mx-3 sm:mx-5">
                <img src="/logos/63456bf0027bd0c200327287_Primary B Blck.svg" alt="Primary B Logo" className="h-12 sm:h-16 object-contain filter brightness-0" />
              </div>
            </motion.div>
            
            {/* Add subtle gradient overlay at edges for fade effect */}
            <div className="absolute top-0 left-0 h-full w-12 sm:w-24 bg-gradient-to-r from-white to-transparent z-10"></div>
            <div className="absolute top-0 right-0 h-full w-12 sm:w-24 bg-gradient-to-l from-white to-transparent z-10"></div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;
