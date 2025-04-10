import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import RevealAnimation from '../components/animations/RevealAnimation';
import HoverAnimation from '../components/animations/HoverAnimation';
import Testimonials from '../components/Testimonials';

const HomePage = () => {
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
          <motion.div
            className="max-w-2xl"
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
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-ms-gray-50">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <RevealAnimation delay={0.1}>
              <HoverAnimation className="h-full">
                <div className="p-6 bg-white rounded-ms-md shadow-ms h-full text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                      <i className="fas fa-building text-2xl text-primary"></i>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">Bristol & Southwest Security Services</h3>
                </div>
              </HoverAnimation>
            </RevealAnimation>

            <RevealAnimation delay={0.2}>
              <HoverAnimation className="h-full">
                <div className="p-6 bg-white rounded-ms-md shadow-ms h-full text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                      <i className="fas fa-user-shield text-2xl text-primary"></i>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">Highly Trained Security Staff</h3>
                </div>
              </HoverAnimation>
            </RevealAnimation>

            <RevealAnimation delay={0.3}>
              <HoverAnimation className="h-full">
                <div className="p-6 bg-white rounded-ms-md shadow-ms h-full text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                      <i className="fas fa-file-contract text-2xl text-primary"></i>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">Ready To Accept Any Contracts</h3>
                </div>
              </HoverAnimation>
            </RevealAnimation>

            <RevealAnimation delay={0.4}>
              <HoverAnimation className="h-full">
                <div className="p-6 bg-white rounded-ms-md shadow-ms h-full text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                      <i className="fas fa-headset text-2xl text-primary"></i>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">Exceptional Customer Service</h3>
                </div>
              </HoverAnimation>
            </RevealAnimation>

            <RevealAnimation delay={0.5}>
              <HoverAnimation className="h-full">
                <div className="p-6 bg-white rounded-ms-md shadow-ms h-full text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                      <i className="fas fa-handshake text-2xl text-primary"></i>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">Working Closely With Our Clients</h3>
                </div>
              </HoverAnimation>
            </RevealAnimation>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20">
        <div className="container">
          <RevealAnimation>
            <div className="text-center mb-16">
              <h2 className="ms-section-title inline-flex items-center">
                <span className="w-10 h-1 bg-primary mr-4"></span>
                Professional Security Team
                <span className="w-10 h-1 bg-primary ml-4"></span>
              </h2>
              <p className="ms-section-subtitle text-center">
                With over 15 years of experience and a dedicated team of SIA licensed professionals
              </p>
            </div>
          </RevealAnimation>

          <div className="max-w-4xl mx-auto">
            <RevealAnimation direction="up" delay={0.2}>
              <p className="text-ms-gray-700 mb-6 leading-relaxed">
                Mead Security is an independent professional organisation dedicated to bringing you security services tailored to your needs, providing expert security guards across Bristol and throughout the South West. With over 15 years combined experience and sector knowledge, we are dedicated to providing cost effective security solutions delivered by fully SIA licenced and experienced personnel.
              </p>
            </RevealAnimation>
            <RevealAnimation direction="up" delay={0.3}>
              <p className="text-ms-gray-700 leading-relaxed">
                We pride ourselves on providing well trained and hand picked SIA professionals throughout our venues and understand that each venue is unique and requires different policies and flexibility. Our mission is to provide reliable and valuable security services to clients through honesty and professionalism. We understand that customer service is a key aspect of security and we excel at providing the best possible experience for our customers.
              </p>
            </RevealAnimation>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-ms-gray-50">
        <div className="container">
          <RevealAnimation>
            <div className="text-center mb-16">
              <h2 className="ms-section-title inline-flex items-center">
                <span className="w-10 h-1 bg-primary mr-4"></span>
                Our Services
                <span className="w-10 h-1 bg-primary ml-4"></span>
              </h2>
              <p className="ms-section-subtitle text-center">
                We offer a comprehensive range of security services to meet all your needs
              </p>
            </div>
          </RevealAnimation>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Door Supervisor */}
            <RevealAnimation direction="left" delay={0.1}>
              <HoverAnimation>
                <div className="bg-white rounded-ms-md overflow-hidden shadow-ms transition-shadow duration-200 group h-full">
                  <div className="relative overflow-hidden">
                    <img
                      src="https://ext.same-assets.com/759128491/1822000629.jpeg"
                      alt="Door Supervisor Service"
                      className="w-full h-60 object-cover transform group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                      <div className="p-4 w-full">
                        <h3 className="text-xl font-bold text-white">Door Supervisor</h3>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Door Supervisor</h3>
                    <p className="text-ms-gray-600 mb-4 line-clamp-3">
                      We provide professional, approachable and highly trained SIA door supervisors to ensure the safety of customers and the security of your premises.
                    </p>
                    <Link to="/services#door-supervisor" className="text-primary font-medium inline-flex items-center group/link">
                      Learn More
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </HoverAnimation>
            </RevealAnimation>

            {/* Static Guarding */}
            <RevealAnimation direction="up" delay={0.2}>
              <HoverAnimation>
                <div className="bg-white rounded-ms-md overflow-hidden shadow-ms transition-shadow duration-200 group h-full">
                  <div className="relative overflow-hidden">
                    <img
                      src="https://ext.same-assets.com/759128491/4004151153.jpeg"
                      alt="Static Guarding Service"
                      className="w-full h-60 object-cover transform group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                      <div className="p-4 w-full">
                        <h3 className="text-xl font-bold text-white">Static Guarding</h3>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Static Guarding</h3>
                    <p className="text-ms-gray-600 mb-4 line-clamp-3">
                      We provide efficient and effective, professional services focused on deterring crime and ensuring the premises and personnel are secure.
                    </p>
                    <Link to="/services#static-guard" className="text-primary font-medium inline-flex items-center group/link">
                      Learn More
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </HoverAnimation>
            </RevealAnimation>

            {/* Concierge */}
            <RevealAnimation direction="right" delay={0.3}>
              <HoverAnimation>
                <div className="bg-white rounded-ms-md overflow-hidden shadow-ms transition-shadow duration-200 group h-full">
                  <div className="relative overflow-hidden">
                    <img
                      src="https://ext.same-assets.com/759128491/3502850542.jpeg"
                      alt="Concierge Service"
                      className="w-full h-60 object-cover transform group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                      <div className="p-4 w-full">
                        <h3 className="text-xl font-bold text-white">Concierge</h3>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Concierge</h3>
                    <p className="text-ms-gray-600 mb-4 line-clamp-3">
                      We provide efficient and effective, professional services focused on deterring crime and ensuring the premises and personnel are secure.
                    </p>
                    <Link to="/services#concierge" className="text-primary font-medium inline-flex items-center group/link">
                      Learn More
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </HoverAnimation>
            </RevealAnimation>
          </div>

          <div className="text-center mt-12">
            <RevealAnimation direction="up" delay={0.4}>
              <HoverAnimation>
                <Link to="/services" className="ms-btn">
                  View All Services
                </Link>
              </HoverAnimation>
            </RevealAnimation>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      {/* Why Choose Us Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <RevealAnimation direction="left">
                <div className="mb-6 inline-flex items-center">
                  <div className="w-12 h-1 bg-primary mr-4"></div>
                  <span className="text-ms-gray-500 uppercase tracking-wider text-sm font-medium">Why choose us</span>
                </div>
                <h2 className="text-3xl font-bold mb-8 leading-tight">
                  Why work with Mead Security?
                </h2>
                <div className="space-y-6">
                  <RevealAnimation direction="left" delay={0.1}>
                    <div className="flex">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary bg-opacity-20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-ms-gray-700 leading-relaxed">
                          Mead security has provided professional security services for a number of venues and events in Bristol and the South west. We have also provided security for a number of static sites, as well as film/TV. We also work with other security companies for large venues/events.
                        </p>
                      </div>
                    </div>
                  </RevealAnimation>
                  <RevealAnimation direction="left" delay={0.2}>
                    <div className="flex">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary bg-opacity-20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-ms-gray-700 leading-relaxed">
                          We work closely with you, the client, in order to achieve the best possible security solution for your venue/event, this means you know exactly what your getting.
                        </p>
                      </div>
                    </div>
                  </RevealAnimation>
                  <RevealAnimation direction="left" delay={0.3}>
                    <div className="flex">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary bg-opacity-20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-ms-gray-700 leading-relaxed">
                          It is our main priority that not only your venue/event is protected but also that the staff and customers are safe. With our SIA licensed personnel we can achieve this, making your customers and staff happy to be in a safe environment.
                        </p>
                      </div>
                    </div>
                  </RevealAnimation>
                </div>
              </RevealAnimation>
            </div>

            <RevealAnimation direction="right" delay={0.2}>
              <div className="bg-ms-gray-50 p-8 rounded-ms-md shadow-ms">
                <h3 className="text-2xl font-semibold mb-6 flex items-center">
                  <div className="w-1 h-6 bg-primary mr-3"></div>
                  Areas We Cover
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <ul className="space-y-3">
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Bath
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Bristol
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Devon
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Exeter
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Gloucester
                      </li>
                    </ul>
                  </div>
                  <div>
                    <ul className="space-y-3">
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Plymouth
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Salisbury
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Somerset
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Turo
                      </li>
                      <li className="flex items-center text-ms-gray-700">
                        <i className="fas fa-check-circle text-primary mr-3"></i> Wells
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </RevealAnimation>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-white">
        <motion.div
          className="container text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6">
            Need a Security Solution?
          </h2>
          <p className="max-w-2xl mx-auto mb-10 text-white/90 text-lg">
            Get in touch with our team today to discuss your security requirements. We offer free consultations and competitive quotes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <HoverAnimation scale={1.05}>
              <Link to="/contact" className="inline-flex items-center justify-center px-8 py-3 font-medium bg-white text-primary rounded-ms-md hover:bg-opacity-90 transition-all duration-200">
                Contact Us Today
              </Link>
            </HoverAnimation>
            <HoverAnimation scale={1.05}>
              <a href="https://same-rqmlmf5nx6q-latest.netlify.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-8 py-3 font-medium border-2 border-white text-white rounded-ms-md hover:bg-white hover:text-primary transition-all duration-200">
                Staff Portal
              </a>
            </HoverAnimation>
          </div>
        </motion.div>
      </section>
    </>
  );
};

export default HomePage;
