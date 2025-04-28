describe('Test Environment', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true);
  });

  it('should handle async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
}); 