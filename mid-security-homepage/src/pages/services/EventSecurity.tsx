import React from 'react';
import { Link } from 'react-router-dom';

const EventSecurity = () => {
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
                  <span className="ml-1 text-primary md:ml-2">Event Security</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-16">
          <div className="relative h-80">
            <img 
              src="https://ext.same-assets.com/759128491/2044315926.jpeg" 
              alt="Event Security Service" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center">
              <div className="container">
                <h1 className="text-4xl font-bold text-white mb-4">Event Security</h1>
                <p className="text-xl text-white opacity-90 max-w-3xl">
                  Comprehensive security solutions for events of all sizes, ensuring safety and peace of mind.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Main Info */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-6">Professional Event Security Services</h2>
            
            <p className="text-gray-700 mb-6">
            At Mead Security, we provide trusted, high-capacity security solutions for large-scale events such as festivals, concerts, and public gatherings across Bristol and the South West. Our experienced teams are trained to manage ingress and egress, ensuring smooth, safe movement of large crowds while maintaining tight control over entry points, ticket validation, and restricted access zones.
We understand the complex dynamics of major events and work closely with organisers, stewards, and emergency services to create a secure environment without compromising the guest experience. From bag checks and perimeter patrols to rapid incident response, our presence is proactive, visible, and reassuring.
Whether it’s a multi-day outdoor festival or a high-profile indoor event, Mead Security delivers the planning, personnel, and professionalism you need to protect people, property, and peace of mind.
            </p>

            <h3 className="text-2xl font-medium mb-4 mt-8">Key Features</h3>
            <ul className="list-disc pl-6 mb-8 text-gray-700 space-y-2">
              <li>Comprehensive event risk assessment and planning</li>
              <li>Crowd management and access control</li>
              <li>SIA licensed security professionals</li>
              <li>Emergency response coordination</li>
              <li>VIP and talent protection</li>
              <li>Ticket validation and entry management</li>
              <li>Anti-counterfeiting measures</li>
              <li>Coordination with venue staff and emergency services</li>
              <li>Post-event reporting and analysis</li>
            </ul>

            <h3 className="text-2xl font-medium mb-4 mt-8">Types of Events We Secure</h3>
            <div className="mb-8">
              <p className="text-gray-700 mb-4">Our event security services are suitable for a wide range of occasions:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Music Festivals & Concerts</h4>
                  <p className="text-gray-600">Comprehensive security for music events of all sizes, from intimate venues to large festivals.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Sporting Events</h4>
                  <p className="text-gray-600">Crowd management and access control for matches, tournaments, and competitive sports.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Corporate Functions</h4>
                  <p className="text-gray-600">Discreet security for product launches, annual meetings, and corporate celebrations.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Public Exhibitions</h4>
                  <p className="text-gray-600">Security for trade shows, conventions, and public exhibitions with valuable displays.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Community Events</h4>
                  <p className="text-gray-600">Safety management for town fairs, parades, and local celebrations.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Private Celebrations</h4>
                  <p className="text-gray-600">Tailored security for weddings, parties, and exclusive private gatherings.</p>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-4 mt-8">Why Choose Mead Security for Your Event?</h3>
            <p className="text-gray-700 mb-6">
              Our management team treats every event with the same level of importance regardless of size. We understand that each gathering has unique security requirements, and we develop customized plans that address your specific needs while maintaining the atmosphere you want for your event.
            </p>
            <p className="text-gray-700 mb-6">
              With Mead Security, you're not just hiring security personnel – you're partnering with event security experts who will work closely with your team from planning to execution. Our staff are selected for their ability to remain vigilant while being approachable and helpful to your guests.
            </p>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-semibold mb-5">Request a Quote</h3>
              <p className="mb-4 text-gray-600">
                Planning an event that requires security? Contact us for a detailed proposal tailored to your specific event needs.
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
                    <Link to="/services/door-supervisor" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Door Supervisor
                    </Link>
                  </li>
                  <li>
                    <Link to="/services/static-guard" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Static Guarding
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

export default EventSecurity;
