export default async function handler(req: any, res: any) {
  res.status(200).json({ pong: true, method: req.method })
}
