import { motion } from 'framer-motion';

const AboutPage = () => {
  return (
    <>

      {/* About Company */}
      <section className="py-16">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Bristol & Southwest Security Solutions
              </h2>
              <div className="w-20 h-1 bg-primary mb-6"></div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-gray-700">
                  <i className="fas fa-check-circle text-primary mr-3"></i> Door Supervisor
                </li>
                <li className="flex items-center text-gray-700">
                  <i className="fas fa-check-circle text-primary mr-3"></i> Static Guard
                </li>
                <li className="flex items-center text-gray-700">
                  <i className="fas fa-check-circle text-primary mr-3"></i> Concierge
                </li>
                <li className="flex items-center text-gray-700">
                  <i className="fas fa-check-circle text-primary mr-3"></i> Event Security
                </li>
                <li className="flex items-center text-gray-700">
                  <i className="fas fa-check-circle text-primary mr-3"></i> Gate House Security
                </li>
                <li className="flex items-center text-gray-700">
                  <i className="fas fa-check-circle text-primary mr-3"></i> Key Holding
                </li>
              </ul>
              <p className="text-gray-700 mb-4">
              Mead Security is a Bristol-based security company committed to delivering professional, dependable, and people-focused protection across the South West and beyond. With deep roots in the local community and a reputation built on trust, we provide tailored security solutions that keep people safe and businesses secure.

              </p>
              <p className="text-gray-700">
              Our team of SIA-licensed officers bring a wealth of frontline experience to every contract, whether it’s door supervision, static site guarding, mobile patrols, educational campuses or event security. We pride ourselves on being highly visible when needed, discreet when required, and always adaptable to the needs of our clients.
              We don’t believe in a one-size-fits-all approach. Instead, we take the time to understand your environment, your risks, and your expectations—then deliver a service that exceeds them.
              </p>
            </div>
            <div>
              <img
                src="https://ext.same-assets.com/759128491/202070860.jpeg"
                alt="Mead Security Professional Team"
                className="rounded-lg shadow-lg w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section className="py-16 bg-light-gray">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Our Mission</h2>
            <div className="w-20 h-1 bg-primary mx-auto mb-6"></div>
            <p className="text-gray-700 text-lg mb-4">
            At Mead Security, our mission is simple:
To protect what matters most—through professionalism, presence, and people-first service.

            </p>
            <p className="text-gray-700 text-lg">
            We aim to set the standard for local security by combining expert personnel, clear communication, and genuine community care.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why work with Mead Security?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-shield-alt text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-bold mb-3">Extensive Experience</h3>
              <p className="text-gray-700">
                With over 15 years of combined experience in the security industry, we bring expertise and knowledge to every assignment.
              </p>
            </div>

            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-user-tie text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-bold mb-3">Fully SIA Licensed Staff</h3>
              <p className="text-gray-700">
                All our security personnel are fully SIA licensed, trained, and regularly undergo professional development.
              </p>
            </div>

            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-handshake text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-bold mb-3">Client-Focused Approach</h3>
              <p className="text-gray-700">
                We work closely with clients to understand their unique requirements and provide tailored security solutions.
              </p>
            </div>

            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-headset text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-bold mb-3">Customer Service Excellence</h3>
              <p className="text-gray-700">
                We believe security personnel represent your business, which is why we emphasize customer service skills.
              </p>
            </div>

            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-clock text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-bold mb-3">Flexible & Reliable</h3>
              <p className="text-gray-700">
                From last-minute requirements to long-term contracts, we provide reliable security services when you need them.
              </p>
            </div>

            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-map-marked-alt text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-bold mb-3">Wide Area Coverage</h3>
              <p className="text-gray-700">
                We provide security services throughout Bristol and the South West, covering multiple locations and venues.
              </p>
            </div>
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

export default AboutPage;
