import { render, screen } from '@testing-library/react';
import SignalChart from './SignalChart';

test('renders minimum, current, maximum and threshold without branch residue', () => {
  render(<SignalChart label="TEMP" value={20} low={10} high={25} unit="°" min={-10} max={40} thresholds={[{ value: 12, label: '12°' }]} />);
  expect(screen.getByRole('img', { name: 'TEMP 현재 20°, 최저 10°, 최고 25°, 임계값 12°' })).toBeInTheDocument();
  expect(screen.getByText('최저 10°')).toBeInTheDocument();
  expect(screen.getByText('최고 25°')).toBeInTheDocument();
  expect(screen.getByText('현재')).toBeInTheDocument();
});
