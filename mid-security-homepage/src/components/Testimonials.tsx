import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RevealAnimation from './animations/RevealAnimation';

type Testimonial = {
  id: number;
  quote: string;
  author: string;
  role: string;
  company: string;
  image: string;
};

const testimonials: Testimonial[] = [
  {
    id: 1,
    quote: "Mead Security's door supervisors have been excellent for our venue. Professional, friendly and always vigilant. They're now an integral part of our operation.",
    author: "Michael Thompson",
    role: "Operations Manager",
    company: "Venue Bristol",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
  },
  {
    id: 2,
    quote: "We've used Mead Security for several major events and they've always delivered a top-notch service. Their team is responsive, well-trained, and customer-focused.",
    author: "Sarah Richards",
    role: "Event Director",
    company: "SouthWest Events",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
  },
  {
    id: 3,
    quote: "The concierge security service provided by Mead has transformed how our residents feel about security. Professional, courteous and always alert.",
    author: "James Wilson",
    role: "Property Manager",
    company: "Harborside Residences",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
  }
];

const Testimonials = () => {
  const [current, setCurrent] = useState(0);

  const nextTestimonial = () => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-20 bg-ms-gray-50">
      <div className="container">
        <RevealAnimation>
          <div className="text-center mb-16">
            <h2 className="ms-section-title inline-flex items-center">
              <span className="w-10 h-1 bg-primary mr-4"></span>
              What Our Clients Say
              <span className="w-10 h-1 bg-primary ml-4"></span>
            </h2>
            <p className="ms-section-subtitle text-center">
              Trusted by businesses and venues throughout Bristol and the South West
            </p>
          </div>
        </RevealAnimation>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1]
                }}
                className="bg-white p-8 rounded-ms-md shadow-ms relative border border-ms-gray-200"
              >
                <div className="absolute -top-5 left-10 bg-primary text-white p-2 rounded-ms-md">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.5 10c-.223 0-.437.034-.65.065.069-.232.14-.468.254-.68.114-.308.292-.575.469-.844.148-.291.409-.488.601-.737.201-.242.475-.403.692-.604.213-.21.492-.315.714-.463.232-.133.434-.28.65-.35.208-.086.39-.16.539-.222.302-.125.474-.197.474-.197L9.758 4.03c0 0-.218.052-.597.144C8.97 4.222 8.737 4.278 8.472 4.345c-.271.05-.56.187-.882.312C7.272 4.799 6.904 4.895 6.562 5.123c-.344.218-.741.4-1.091.692C5.132 6.116 4.723 6.377 4.421 6.76c-.33.358-.656.734-.909 1.162C3.219 8.33 3.02 8.778 2.81 9.221c-.19.443-.343.896-.468 1.336-.237.882-.343 1.72-.384 2.437-.034.718-.014 1.315.028 1.747.015.204.043.402.063.539.017.109.025.168.025.168l.026-.006C2.535 17.474 4.338 19 6.5 19c2.485 0 4.5-2.015 4.5-4.5S8.985 10 6.5 10zM17.5 10c-.223 0-.437.034-.65.065.069-.232.14-.468.254-.68.114-.308.292-.575.469-.844.148-.291.409-.488.601-.737.201-.242.475-.403.692-.604.213-.21.492-.315.714-.463.232-.133.434-.28.65-.35.208-.086.39-.16.539-.222.302-.125.474-.197.474-.197L20.758 4.03c0 0-.218.052-.597.144-.191.048-.424.104-.689.171-.271.05-.56.187-.882.312-.317.143-.686.238-1.028.467-.344.218-.741.4-1.091.692-.339.301-.748.562-1.05.944-.33.358-.656.734-.909 1.162C14.219 8.33 14.02 8.778 13.81 9.221c-.19.443-.343.896-.468 1.336-.237.882-.343 1.72-.384 2.437-.034.718-.014 1.315.028 1.747.015.204.043.402.063.539.017.109.025.168.025.168l.026-.006C13.535 17.474 15.338 19 17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10z" />
                  </svg>
                </div>

                <div className="pt-6">
                  <p className="text-ms-gray-700 text-lg leading-relaxed mb-6 italic">
                    "{testimonials[current].quote}"
                  </p>

                  <div className="flex items-center">
                    <img
                      src={testimonials[current].image}
                      alt={testimonials[current].author}
                      className="w-14 h-14 rounded-full object-cover border-2 border-ms-gray-200"
                    />
                    <div className="ml-4">
                      <h4 className="font-semibold text-ms-gray-800">{testimonials[current].author}</h4>
                      <p className="text-ms-gray-600 text-sm">
                        {testimonials[current].role}, {testimonials[current].company}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8">
              <button
                onClick={prevTestimonial}
                className="bg-white p-3 rounded-full shadow-ms-sm hover:shadow-ms border border-ms-gray-200 focus:outline-none transition-shadow duration-200"
                aria-label="Previous testimonial"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <div className="flex space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrent(index)}
                    className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                      index === current ? 'bg-primary' : 'bg-ms-gray-300'
                    }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={nextTestimonial}
                className="bg-white p-3 rounded-full shadow-ms-sm hover:shadow-ms border border-ms-gray-200 focus:outline-none transition-shadow duration-200"
                aria-label="Next testimonial"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
