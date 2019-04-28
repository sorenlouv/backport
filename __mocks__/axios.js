const axios = jest.genMockFromModule('axios');
axios.get = jest.fn(() => {
  throw new Error('Forgot to mock axios.get');
});
axios.post = jest.fn(() => {
  throw new Error('Forgot to mock axios.post');
});
module.exports = axios;
