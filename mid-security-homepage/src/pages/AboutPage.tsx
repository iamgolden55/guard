import { Link } from 'react-router-dom';

const AboutPage = () => {
  return (
    <>
      {/* Page Header */}
      <section
        className="relative bg-cover bg-center bg-no-repeat py-32"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('https://ext.same-assets.com/764186857/1001001560.jpeg')`
        }}
      >
        <div className="container text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            About Us
          </h1>
          <div className="flex justify-center">
            <nav className="flex text-white">
              <Link to="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">»</span>
              <span className="text-primary">About Us</span>
            </nav>
          </div>
        </div>
      </section>

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
                Mead Security is an independent professional organization dedicated to bringing you security services tailored to your needs. We provide expert security guards across Bristol and throughout the South West. With over 15 years combined experience, we are dedicated to providing cost effective security solutions delivered by fully SIA licensed and experienced personnel.
              </p>
              <p className="text-gray-700">
                We pride ourselves on providing well trained and hand picked SIA professionals throughout our venues. We understand that each venue is unique and requires different policies and flexibility. This is why we work closely with our clients so we are able to deliver quality professional security. At Mead Security we understand that customer service is a key aspect of security and we excel at providing the best possible experience for our customers.
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
              At Mead Security, our mission is to deliver exceptional security services that protect our clients' assets, staff, and customers while maintaining a welcoming and professional environment.
            </p>
            <p className="text-gray-700 text-lg">
              We believe that effective security goes beyond just physical presence - it requires trained professionals who understand customer service, communication, and the unique needs of each venue. Our goal is to be the most trusted security provider in Bristol and the South West, known for our reliability, professionalism, and commitment to excellence.
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

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to work with our professional team?
          </h2>
          <p className="max-w-2xl mx-auto mb-8">
            Contact us today for a free security assessment and quotation. Our team is ready to help you find the perfect security solution for your needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/contact" className="inline-block px-8 py-4 font-bold bg-white text-primary rounded-lg hover:bg-opacity-90 transition-all">
              Contact Us Today
            </Link>
            <a href="https://same-rqmlmf5nx6q-latest.netlify.app" target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-4 font-bold border-2 border-white text-white rounded-lg hover:bg-white hover:text-primary transition-all">
              Staff Portal
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
