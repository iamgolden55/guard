import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <section className="py-32 bg-light-gray">
      <div className="container text-center">
        <h1 className="text-9xl font-bold text-primary mb-6">404</h1>
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Page Not Found</h2>
        <p className="text-gray-700 max-w-2xl mx-auto mb-8">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link to="/" className="btn px-8 py-3">
          Back to Homepage
        </Link>
      </div>
    </section>
  );
};

export default NotFoundPage;
