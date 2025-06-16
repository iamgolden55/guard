// Using JSX without explicit React import (modern JSX transform)
import { Link } from 'react-router-dom';

const GateHouse = () => {
  return (
    <div className="pt-12 pb-20">
      <div className="container">
        {/* Breadcrumb */}
        <div className="mb-8">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link to="/" className="text-gray-700 hover:text-primary">
                  Home
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                  </svg>
                  <Link to="/services" className="ml-1 text-gray-700 hover:text-primary md:ml-2">
                    Services
                  </Link>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                  </svg>
                  <span className="ml-1 text-primary md:ml-2">Gate House Security</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-16">
          <div className="relative h-80">
            <img 
              src="https://ext.same-assets.com/759128491/3802265204.jpeg" 
              alt="Gate House Security Service" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center">
              <div className="container">
                <h1 className="text-4xl font-bold text-white mb-4">Gate House Security</h1>
                <p className="text-xl text-white opacity-90 max-w-3xl">
                  Bespoke security solutions for controlling access to private and commercial premises.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Main Info */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-6">Professional Gate House Security Services</h2>
            
            <p className="text-gray-700 mb-6">
              Our Gate House Security services provide a crucial first line of defense for properties requiring controlled access. With professionally trained security personnel manning your entrance points, we ensure that only authorized individuals gain access to your premises while maintaining detailed visitor records.
            </p>

            <h3 className="text-2xl font-medium mb-4 mt-8">Key Features</h3>
            <ul className="list-disc pl-6 mb-8 text-gray-700 space-y-2">
              <li>24/7 manned gate house security</li>
              <li>Advanced visitor management systems</li>
              <li>Vehicle inspection and registration checking</li>
              <li>Access control and ID verification</li>
              <li>CCTV monitoring and surveillance</li>
              <li>Detailed entry and exit logging</li>
              <li>Emergency protocols and response coordination</li>
              <li>Regular security patrols of the perimeter</li>
              <li>Communication with on-site security teams</li>
            </ul>

            <h3 className="text-2xl font-medium mb-4 mt-8">Who Benefits from Gate House Security?</h3>
            <div className="mb-8">
              <p className="text-gray-700 mb-4">Our gate house security services are ideal for:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Gated Communities</h4>
                  <p className="text-gray-600">Controlling access to residential estates and ensuring resident safety.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Industrial Complexes</h4>
                  <p className="text-gray-600">Monitoring entry to factories, warehouses, and logistics centers.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Business Parks</h4>
                  <p className="text-gray-600">Managing access to multiple business premises within a shared complex.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Private Estates</h4>
                  <p className="text-gray-600">Providing security and privacy for high-net-worth individuals and families.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Education Campuses</h4>
                  <p className="text-gray-600">Controlling vehicle and pedestrian access to schools and university grounds.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Healthcare Facilities</h4>
                  <p className="text-gray-600">Managing traffic flow and monitoring visitors to hospitals and clinics.</p>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-4 mt-8">Why Choose Mead Security's Gate House Service?</h3>
            <p className="text-gray-700 mb-6">
              Our gate house security personnel are specially trained not only in security procedures but also in customer service, as they often serve as the first point of contact for visitors to your premises. They project a professional image while maintaining rigorous security standards.
            </p>
            <p className="text-gray-700 mb-6">
              We can integrate our gate house security with other security measures, such as CCTV systems, access control technology, and on-site security teams, creating a comprehensive security solution tailored to your specific needs. Our management team will work with you to develop protocols that balance security requirements with operational efficiency.
            </p>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-semibold mb-5">Request a Quote</h3>
              <p className="mb-4 text-gray-600">
                Need professional gate house security for your premises? Contact us for a customized security solution.
              </p>
              <Link 
                to="/contact"
                className="bg-primary text-white px-6 py-3 rounded-lg inline-block font-medium hover:bg-primary-dark transition duration-300"
              >
                Contact Us
              </Link>

              <div className="mt-8 border-t pt-8">
                <h4 className="font-semibold mb-3">Related Services</h4>
                <ul className="space-y-3">
                  <li>
                    <Link to="/services/static-guard" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Static Guarding
                    </Link>
                  </li>
                  <li>
                    <Link to="/services/key-holding" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Key Holding
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t pt-8">
                <h4 className="font-semibold mb-3">Certifications</h4>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <img src="/imgs/sia-approved-icon.png" alt="SIA Approved" className="h-12" />
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <img src="/imgs/security-certification.png" alt="Security Certification" className="h-12" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateHouse;
