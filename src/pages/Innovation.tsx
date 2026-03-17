import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Innovation() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/innovation/requests', { replace: true }); }, [navigate]);
  return null;
}
