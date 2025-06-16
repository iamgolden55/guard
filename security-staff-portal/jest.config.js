module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    ".+\\.(css|scss|png|jpg|svg)$": "jest-transform-stub"
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}; 