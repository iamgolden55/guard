import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

// Define service types and data structure
type ServiceCategory = 'all' | 'venue' | 'event' | 'commercial' | 'residential';

interface Service {
  id: string;
  title: string;
  category: ServiceCategory[];
  description: string;
  image: string;
}

// Sample services data
const services: Service[] = [
  {
    id: 'door-supervisor',
    title: 'Door Supervisor',
    category: ['venue', 'event'],
    description: 'Professional, approachable and highly trained SIA door supervisors to ensure the safety of customers and the security of your premises.',
    image: 'https://ext.same-assets.com/759128491/1822000629.jpeg'
  },
  {
    id: 'static-guard',
    title: 'Static Guarding',
    category: ['commercial', 'venue'],
    description: 'Efficient and effective, professional services focused on deterring crime and ensuring the premises and personnel are secure.',
    image: 'https://ext.same-assets.com/759128491/4004151153.jpeg'
  },
  {
    id: 'concierge',
    title: 'Concierge',
    category: ['residential', 'commercial'],
    description: 'Specially tailored security services to maintain and protect the safety and security of residential and commercial premises.',
    image: 'https://ext.same-assets.com/759128491/3502850542.jpeg'
  },
  {
    id: 'event-security',
    title: 'Event Security',
    category: ['event'],
    description: 'Vastly experienced management team that treats every event with the utmost importance regardless of size.',
    image: 'https://ext.same-assets.com/759128491/2044315926.jpeg'
  },
  {
    id: 'gate-house',
    title: 'Gate House Security',
    category: ['commercial', 'residential'],
    description: 'Bespoke and professional solutions to meet the needs of clients for private and business premises.',
    image: 'https://ext.same-assets.com/759128491/3802265204.jpeg'
  },
  {
    id: 'key-holding',
    title: 'Key Holding',
    category: ['residential', 'commercial'],
    description: 'Fully trained SIA personnel experienced in key holding for both residential and commercial properties.',
    image: 'https://ext.same-assets.com/759128491/3383970169.jpeg'
  }
];

// Filter category names for display
const categoryDisplayNames: Record<ServiceCategory, string> = {
  all: 'All Services',
  venue: 'Venue Security',
  event: 'Event Security',
  commercial: 'Commercial',
  residential: 'Residential'
};

const ServiceFilter = () => {
  const [activeFilter, setActiveFilter] = useState<ServiceCategory>('all');
  const [filteredServices, setFilteredServices] = useState<Service[]>(services);

  // Handle filter change
  const handleFilterChange = (category: ServiceCategory) => {
    setActiveFilter(category);

    if (category === 'all') {
      setFilteredServices(services);
    } else {
      const filtered = services.filter(service =>
        service.category.includes(category)
      );
      setFilteredServices(filtered);
    }
  };

  // Microsoft animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  return (
    <div className="py-16">
      <div className="container">
        <h2 className="ms-section-title text-center mb-8">Our Security Services</h2>

        {/* Filter tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {(Object.keys(categoryDisplayNames) as ServiceCategory[]).map((category) => (
            <motion.button
              key={category}
              onClick={() => handleFilterChange(category)}
              className={`px-4 py-2 rounded-ms-md border transition-all ${
                activeFilter === category
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-ms-gray-700 border-ms-gray-200 hover:border-primary'
              }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {categoryDisplayNames[category]}
            </motion.button>
          ))}
        </div>

        {/* Services grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="wait">
            {filteredServices.map((service) => (
              <motion.div
                key={service.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-white rounded-ms-md overflow-hidden shadow-ms hover:shadow-ms-md transition-shadow duration-200 group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-56 object-cover transform group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4 w-full">
                      <h3 className="text-xl font-bold text-white">{service.title}</h3>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-3">{service.title}</h3>
                  <p className="text-ms-gray-600 mb-4 line-clamp-3">
                    {service.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {service.category.map(cat => (
                      <span
                        key={cat}
                        className="inline-block text-xs px-2 py-1 bg-ms-gray-100 text-ms-gray-600 rounded-md"
                      >
                        {categoryDisplayNames[cat]}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/services#${service.id}`}
                    className="text-primary font-medium inline-flex items-center group/link"
                  >
                    Learn More
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredServices.length === 0 && (
          <div className="text-center p-10 bg-ms-gray-50 rounded-ms-md">
            <p className="text-ms-gray-600">No services found for the selected category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceFilter;
