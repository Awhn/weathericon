import { render, screen } from '@testing-library/react';
import SignalChart from './SignalChart';

test('renders only minimum, current and maximum on the horizontal line', () => {
  render(<SignalChart label="TEMP" value={20} low={10} high={25} unit="°" min={-10} max={40} />);
  expect(screen.getByRole('img', { name: 'TEMP 최저 10°, 현재 20°, 최고 25°' })).toBeInTheDocument();
  expect(screen.getByText('최저 10°')).toBeInTheDocument();
  expect(screen.getByText('최고 25°')).toBeInTheDocument();
  expect(screen.getByText('현재 20°')).toBeInTheDocument();
});
