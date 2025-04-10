import { Link } from 'react-router-dom';
import ServiceFilter from '../components/ServiceFilter';
import RevealAnimation from '../components/animations/RevealAnimation';

const ServicesPage = () => {
  return (
    <>
      {/* Page Header */}
      <section
        className="relative bg-cover bg-center bg-no-repeat py-32"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('https://ext.same-assets.com/764186857/1648852352.jpeg')`
        }}
      >
        <div className="container text-center">
          <RevealAnimation>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Our Services
            </h1>
            <div className="flex justify-center">
              <nav className="flex text-white">
                <Link to="/" className="hover:text-primary">Home</Link>
                <span className="mx-2">»</span>
                <span className="text-primary">Services</span>
              </nav>
            </div>
          </RevealAnimation>
        </div>
      </section>

      {/* Interactive Services Filter */}
      <ServiceFilter />

      {/* Areas We Cover */}
      <section className="py-16 bg-ms-gray-50">
        <div className="container">
          <RevealAnimation>
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Areas We Cover</h2>
              <p className="text-ms-gray-600 text-lg">
                We provide our security services throughout Bristol and the South West region, covering the following locations and surrounding areas:
              </p>
            </div>
          </RevealAnimation>

          <RevealAnimation direction="up" delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Bath</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Bristol</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Devon</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Exeter</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Gloucester</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Plymouth</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Salisbury</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Somerset</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Turo</h3>
              </div>
              <div className="bg-white p-6 rounded-ms-md shadow-ms hover:shadow-ms-md text-center transition-shadow duration-200">
                <div className="w-12 h-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-map-marker-alt text-primary text-xl"></i>
                </div>
                <h3 className="font-semibold">Wells</h3>
              </div>
            </div>
          </RevealAnimation>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="container text-center">
          <RevealAnimation>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Need a Security Solution?
            </h2>
            <p className="max-w-2xl mx-auto mb-8">
              Contact us today for a free consultation and quote. Our experienced team will help you find the perfect security solution for your needs.
            </p>
            <Link to="/contact" className="inline-flex items-center justify-center px-8 py-3 font-medium bg-white text-primary rounded-ms-md hover:bg-opacity-90 transition-all duration-200">
              Get in Touch
            </Link>
          </RevealAnimation>
        </div>
      </section>
    </>
  );
};

export default ServicesPage;
