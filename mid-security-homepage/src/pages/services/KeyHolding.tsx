// Using JSX without explicit React import (modern JSX transform)
import { Link } from 'react-router-dom';

const KeyHolding = () => {
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
                  <span className="ml-1 text-primary md:ml-2">Key Holding</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-16">
          <div className="relative h-80">
            <img 
              src="https://ext.same-assets.com/759128491/3383970169.jpeg" 
              alt="Key Holding Service" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center">
              <div className="container">
                <h1 className="text-4xl font-bold text-white mb-4">Key Holding</h1>
                <p className="text-xl text-white opacity-90 max-w-3xl">
                  Professional key holding solutions for residential and commercial properties with rapid alarm response.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Main Info */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-6">Professional Key Holding Services</h2>
            
            <p className="text-gray-700 mb-6">
              Our Key Holding service provides secure management of your property keys and rapid response to alarm activations. We eliminate the need for you or your staff to attend false alarms or security incidents during unsociable hours, giving you peace of mind that your property is protected around the clock.
            </p>

            <h3 className="text-2xl font-medium mb-4 mt-8">Key Features</h3>
            <ul className="list-disc pl-6 mb-8 text-gray-700 space-y-2">
              <li>Secure storage of property keys in accordance with BS7984</li>
              <li>24/7/365 alarm response service</li>
              <li>Fully trained SIA licensed security officers</li>
              <li>Detailed incident reporting</li>
              <li>Regular property checks available</li>
              <li>Liaison with emergency services when necessary</li>
              <li>Access provision for contractors and maintenance</li>
              <li>Alarm activation investigation</li>
              <li>Full audit trail of key usage</li>
              <li>Insurance company compliant service</li>
            </ul>

            <h3 className="text-2xl font-medium mb-4 mt-8">Who Benefits from Key Holding Services?</h3>
            <div className="mb-8">
              <p className="text-gray-700 mb-4">Our key holding services are ideal for:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Commercial Properties</h4>
                  <p className="text-gray-600">Offices, retail units, and business premises requiring secure access management.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Residential Properties</h4>
                  <p className="text-gray-600">Homeowners who require assistance with alarm activations or emergency access.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Property Managers</h4>
                  <p className="text-gray-600">Companies managing multiple properties who need reliable key management.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Vacant Properties</h4>
                  <p className="text-gray-600">Unoccupied buildings requiring regular checks and emergency access.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Construction Sites</h4>
                  <p className="text-gray-600">Secure access management for contractors and site visitors.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Holiday Homeowners</h4>
                  <p className="text-gray-600">Property owners who spend extended periods away from their homes.</p>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-4 mt-8">Why Choose Mead Security's Key Holding Service?</h3>
            <p className="text-gray-700 mb-6">
              We understand the importance of secure key management and rapid response. Our key holding service is fully compliant with British Standards BS7984 for key holding and alarm response, with robust protocols for key storage, transportation, and usage.
            </p>
            <p className="text-gray-700 mb-6">
              Our response officers are fully SIA licensed and trained to handle a variety of situations, from false alarms to genuine security breaches. They can assess the situation, secure your property, and provide detailed reports of any incidents.
            </p>
            <p className="text-gray-700 mb-6">
              By entrusting your keys to Mead Security, you remove the personal risk of attending alarm activations and gain the assurance that professional security personnel will respond promptly to any alerts, day or night.
            </p>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-semibold mb-5">Request a Quote</h3>
              <p className="mb-4 text-gray-600">
                Looking for reliable key holding services for your property? Get in touch for a personalized security solution.
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
                    <Link to="/services/gate-house" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Gate House Security
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

export default KeyHolding;
