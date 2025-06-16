import ServiceFilter from '../components/ServiceFilter';
import { motion } from 'framer-motion';

const ServicesPage = () => {
  return (
    <>


      {/* Interactive Services Filter */}
      <ServiceFilter />



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

export default ServicesPage;
