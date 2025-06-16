import React from 'react';
import { Link } from 'react-router-dom';

const Concierge = () => {
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
                  <span className="ml-1 text-primary md:ml-2">Concierge</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-16">
          <div className="relative h-80">
            <img 
              src="https://ext.same-assets.com/759128491/3502850542.jpeg" 
              alt="Concierge Service" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center">
              <div className="container">
                <h1 className="text-4xl font-bold text-white mb-4">Concierge</h1>
                <p className="text-xl text-white opacity-90 max-w-3xl">
                  Specially tailored security services that combine safety with exceptional customer service.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Main Info */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-6">Professional Concierge Security Services</h2>
            
            <p className="text-gray-700 mb-6">
              Our Concierge Security services blend professional security with exceptional customer service, providing a welcoming front-of-house presence while ensuring your property remains secure. Our concierge personnel are the perfect solution for residential buildings, corporate offices, and premium commercial properties.
            </p>

            <h3 className="text-2xl font-medium mb-4 mt-8">Key Features</h3>
            <ul className="list-disc pl-6 mb-8 text-gray-700 space-y-2">
              <li>Professional front-desk presence with security training</li>
              <li>Visitor management and access control</li>
              <li>Package handling and delivery acceptance</li>
              <li>Resident or tenant assistance</li>
              <li>Monitoring security systems and CCTV</li>
              <li>Managing guest lists and appointment schedules</li>
              <li>Handling emergency situations with composure</li>
              <li>Maintaining building logs and security records</li>
            </ul>

            <h3 className="text-2xl font-medium mb-4 mt-8">Who Benefits from Concierge Security?</h3>
            <div className="mb-8">
              <p className="text-gray-700 mb-4">Our concierge security services are ideal for:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Residential Complexes</h4>
                  <p className="text-gray-600">Providing security and assistance to residents in apartment buildings and gated communities.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Corporate Offices</h4>
                  <p className="text-gray-600">Managing visitor access, providing information, and maintaining security in business environments.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Luxury Retail</h4>
                  <p className="text-gray-600">Enhancing customer experience while maintaining security for high-end retail establishments.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Mixed-Use Developments</h4>
                  <p className="text-gray-600">Coordinating security across residential, commercial, and retail spaces in one property.</p>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-4 mt-8">Why Choose Mead Security's Concierge Service?</h3>
            <p className="text-gray-700 mb-6">
              Our concierge security professionals undergo specialized training that combines security expertise with superior customer service skills. They represent the perfect balance between vigilant security and welcoming hospitality.
            </p>
            <p className="text-gray-700 mb-6">
              Unlike standard security guards, our concierge staff are selected for their communication abilities and professional demeanor, creating a positive first impression while maintaining robust security protocols. We can tailor our concierge services to match your brand identity and specific property requirements.
            </p>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-semibold mb-5">Request a Quote</h3>
              <p className="mb-4 text-gray-600">
                Looking for professional concierge security for your property? Get in touch for a personalized service proposal.
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

export default Concierge;
