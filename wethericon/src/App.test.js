import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the city search entry screen', () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(screen.getByRole('heading', { name: /오늘, 무엇을 준비할까요/ })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '도시 이름' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /확인/ })).toBeInTheDocument();
});
