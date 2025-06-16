import React from 'react';
import { Link } from 'react-router-dom';

const StaticGuard = () => {
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
                  <span className="ml-1 text-primary md:ml-2">Static Guarding</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-16">
          <div className="relative h-80">
            <img 
              src="https://ext.same-assets.com/759128491/4004151153.jpeg" 
              alt="Static Guarding Service" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center">
              <div className="container">
                <h1 className="text-4xl font-bold text-white mb-4">Static Guarding</h1>
                <p className="text-xl text-white opacity-90 max-w-3xl">
                  Efficient and effective security focused on deterring crime and ensuring your premises remain secure.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Main Info */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-6">Professional Static Guarding Services</h2>
            
            <p className="text-gray-700 mb-6">
            Our Static Guarding service at Mead Security offers round-the-clock protection for commercial properties, construction sites, factories, and industrial facilities. Based in Bristol, we deploy SIA-licensed officers to secure your premises with a reliable on-site presence—day or night.
From preventing unauthorised access to monitoring CCTV, conducting routine patrols, and logging incidents, our guards act as both a visible deterrent and an operational asset. We tailor our guarding strategies to your site layout, risk level, and operational hours, helping to reduce theft, vandalism, and downtime.
Every Mead Security officer is trained to remain alert, professional, and accountable. With detailed reporting and full communication support, you’ll always know your site is in safe hands.
            </p>

            <h3 className="text-2xl font-medium mb-4 mt-8">Key Features</h3>
            <ul className="list-disc pl-6 mb-8 text-gray-700 space-y-2">
              <li>24/7 manned guarding availability</li>
              <li>SIA licensed security professionals</li>
              <li>Comprehensive reporting and incident management</li>
              <li>Regular patrols and security checks</li>
              <li>Access control and visitor management</li>
              <li>CCTV monitoring capabilities</li>
              <li>Emergency response procedures</li>
              <li>Uniformed presence as a visual deterrent</li>
            </ul>

            <h3 className="text-2xl font-medium mb-4 mt-8">Who Benefits from Static Guarding?</h3>
            <div className="mb-8">
              <p className="text-gray-700 mb-4">Our static guarding services are ideal for:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Commercial Buildings</h4>
                  <p className="text-gray-600">Protecting office buildings, retail spaces, and business premises from unauthorized access and theft.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Industrial Sites</h4>
                  <p className="text-gray-600">Securing factories, warehouses, and manufacturing facilities and their valuable equipment.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Construction Sites</h4>
                  <p className="text-gray-600">Protecting materials, machinery, and preventing trespassing at construction sites.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Vacant Properties</h4>
                  <p className="text-gray-600">Ensuring empty buildings remain secure and protected from vandalism or squatters.</p>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-4 mt-8">Why Choose Mead Security's Static Guarding?</h3>
            <p className="text-gray-700 mb-6">
              Our static guards undergo comprehensive training beyond standard SIA requirements, including customer service, emergency protocols, and site-specific procedures. This ensures they're well-prepared to handle any situation while representing your organization professionally.
            </p>
            <p className="text-gray-700 mb-6">
              We take a personalized approach to static guarding, developing security protocols tailored to your specific needs and premises. Our management team conducts regular site visits and quality checks to maintain the highest standards of service.
            </p>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-semibold mb-5">Request a Quote</h3>
              <p className="mb-4 text-gray-600">
                Need static guarding for your property or business? Contact us for a customized security solution.
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
                    <Link to="/services/concierge" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Concierge
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
                    <img src="/logos/SIA+Approved-80h.webp" alt="SIA Approved" className="h-12" />
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

export default StaticGuard;
