// Using JSX without explicit React import (modern JSX transform)
import { Link } from 'react-router-dom';

const DoorSupervisor = () => {
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
                  <span className="ml-1 text-primary md:ml-2">Door Supervisor</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-16">
          <div className="relative h-80">
            <img 
              src="https://ext.same-assets.com/759128491/1822000629.jpeg" 
              alt="Door Supervisor Service" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center">
              <div className="container">
                <h1 className="text-4xl font-bold text-white mb-4">Door Supervisor</h1>
                <p className="text-xl text-white opacity-90 max-w-3xl">
                  Professional SIA licensed door supervisors ensuring safety and security for venues and events.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Main Info */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-6">Professional Door Supervisor Services</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div>
                <p className="text-gray-700">
                At Mead Security, we provide professional door supervisors for pubs, bars, and late-night entertainment venues across Bristol and the South West. We understand the fast-paced, high-risk nature of the night-time economy—and deliver calm, confident security to match.
Our SIA-licensed officers are trained in responsible access control, with a key focus on ID checks to ensure full compliance with licensing laws. From verifying age and refusing entry when necessary to identifying signs of fake or altered IDs, our team protects your venue and reputation at the door.

                </p>
              </div>
              <div className="rounded-lg overflow-hidden shadow-lg">
                <img 
                  src="https://ext.same-assets.com/759128491/door-supervisor-at-work.jpg" 
                  alt="SIA Door Supervisor on duty" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://ext.same-assets.com/759128491/1822000629.jpeg";
                  }}
                />
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-6">Key Features</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="rounded-lg overflow-hidden shadow-lg">
                <img 
                  src="https://ext.same-assets.com/759128491/security-features.jpg" 
                  alt="Door Security Features" 
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://ext.same-assets.com/759128491/1822000629.jpeg";
                  }}
                />
              </div>
              <div>
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  <li>SIA licensed professionals with rigorous vetting</li>
                  <li>Customer service focused approach</li>
                  <li>De-escalation specialists trained in conflict management</li>
                  <li>CCTV management and monitoring capabilities</li>
                  <li>Smart, professional appearance with branded uniforms</li>
                  <li>Comprehensive reporting and incident management</li>
                  <li>Able to manage access control and crowd management</li>
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div>
                <p className="text-gray-700">
                Mead Security door supervisors are more than just a visual deterrent—they’re proactive, approachable, and reliable. We manage queues, monitor behaviour, de-escalate conflict, and support venue staff throughout the night. Our officers wear clean, branded uniforms and maintain a professional appearance at all times, reinforcing your venue's image as safe, secure, and well-managed.
Whether you're running a lively city centre bar or a late-night live music venue, Mead Security ensures your guests feel welcome, your staff feel supported, and your venue stays compliant and in control.                </p>
              </div>
              <div className="rounded-lg overflow-hidden shadow-lg">
                <img 
                  src="https://ext.same-assets.com/759128491/door-supervisor-at-work.jpg" 
                  alt="SIA Door Supervisor on duty" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://ext.same-assets.com/759128491/1822000629.jpeg";
                  }}
                />
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-6">Who Benefits from Door Supervisor Security?</h3>
            <p className="text-gray-700 mb-6">Our door supervisor services are ideal for:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="bg-white rounded-lg overflow-hidden shadow-lg border border-gray-100 transition-transform hover:scale-[1.02]">
                <div className="h-48 overflow-hidden">
                  <img 
                    src="https://ext.same-assets.com/759128491/nightclub-security.jpg" 
                    alt="Nightclub Security" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://ext.same-assets.com/759128491/1822000629.jpeg";
                    }}
                  />
                </div>
                <div className="p-5">
                  <h4 className="font-medium text-lg mb-2">Nightclubs & Bars</h4>
                  <p className="text-gray-600">Ensuring patron safety, age verification and preventing unauthorized entry.</p>
                </div>
              </div>

              <div className="bg-white rounded-lg overflow-hidden shadow-lg border border-gray-100 transition-transform hover:scale-[1.02]">
                <div className="h-48 overflow-hidden">
                  <img 
                    src="https://ext.same-assets.com/759128491/music-venue-security.jpg" 
                    alt="Music Venue Security" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://ext.same-assets.com/759128491/2044315926.jpeg";
                    }}
                  />
                </div>
                <div className="p-5">
                  <h4 className="font-medium text-lg mb-2">Music Venues</h4>
                  <p className="text-gray-600">Managing high-volume crowds and ensuring performer and attendee safety.</p>
                </div>
              </div>

              <div className="bg-white rounded-lg overflow-hidden shadow-lg border border-gray-100 transition-transform hover:scale-[1.02]">
                <div className="h-48 overflow-hidden">
                  <img 
                    src="https://ext.same-assets.com/759128491/corporate-security.jpg" 
                    alt="Corporate Event Security" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://ext.same-assets.com/759128491/3502850542.jpeg";
                    }}
                  />
                </div>
                <div className="p-5">
                  <h4 className="font-medium text-lg mb-2">Corporate Events</h4>
                  <p className="text-gray-600">Professional front-of-house presence for exclusive and high-profile events.</p>
                </div>
              </div>

              <div className="bg-white rounded-lg overflow-hidden shadow-lg border border-gray-100 transition-transform hover:scale-[1.02]">
                <div className="h-48 overflow-hidden">
                  <img 
                    src="https://ext.same-assets.com/759128491/private-party-security.jpg" 
                    alt="Private Party Security" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://ext.same-assets.com/759128491/3383970169.jpeg";
                    }}
                  />
                </div>
                <div className="p-5">
                  <h4 className="font-medium text-lg mb-2">Private Parties</h4>
                  <p className="text-gray-600">Discreet security presence for personal celebrations and VIP gatherings.</p>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-medium mb-6">Why Choose Mead Security's Door Supervisors?</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <p className="text-gray-700 mb-6">
                Mead Security has proudly provided professional, dependable security services across Bristol and the South West for over a decade. From busy nightlife venues to public events, festivals, and educational campuses, our team brings experience, flexibility, and a calm, confident presence to every site we protect.
We specialise in delivering tailored security solutions that match the unique needs of each environment—whether that’s managing access at a city centre bar, supporting the smooth operation of a university campus, or overseeing crowd control at a large-scale event.
What sets us apart is our commitment to working with you, not just for you. 
                </p>
                <p className="text-gray-700">
                We take time to understand your venue, your culture, and your specific concerns—so you can count on a service that’s aligned with your goals and expectations.
All of our officers are SIA-licensed and trained in-house to handle real-world situations with professionalism and respect. Whether interacting with the public, supporting staff, or de-escalating conflict, we focus on keeping people safe while maintaining a welcoming and positive atmosphere.
When you choose Mead Security, you’re choosing a team that’s reliable, approachable, and committed to protecting your people, property, and reputation.
                </p>
              </div>

            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-semibold mb-5">Request a Quote</h3>
              <p className="mb-4 text-gray-600">
                Interested in our Door Supervisor services? Get in touch for a customized quote tailored to your specific needs.
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
                    <Link to="/services/event-security" className="text-primary hover:underline flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Event Security
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

export default DoorSupervisor;
