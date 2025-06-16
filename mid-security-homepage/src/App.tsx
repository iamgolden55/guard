import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';
import Layout from './components/Layout';
import FloatingActionButton from './components/FloatingActionButton';
import MicrosoftChatbot from './components/MicrosoftChatbot';

// Import service detail pages
import DoorSupervisor from './pages/services/DoorSupervisor';
import StaticGuard from './pages/services/StaticGuard';
import Concierge from './pages/services/Concierge';
import EventSecurity from './pages/services/EventSecurity';
import GateHouse from './pages/services/GateHouse';
import KeyHolding from './pages/services/KeyHolding';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/door-supervisor" element={<DoorSupervisor />} />
          <Route path="services/static-guard" element={<StaticGuard />} />
          <Route path="services/concierge" element={<Concierge />} />
          <Route path="services/event-security" element={<EventSecurity />} />
          <Route path="services/gate-house" element={<GateHouse />} />
          <Route path="services/key-holding" element={<KeyHolding />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <FloatingActionButton />
      <MicrosoftChatbot />
    </Router>
  );
}

export default App;
