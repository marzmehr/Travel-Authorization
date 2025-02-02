import express, { Request, Response } from "express";
import { RequiresAuth } from "../middleware";
import knex from "knex";
import { UserService } from "../services";
import {airports} from "../json/airportCodes"
import { TRAVCOM_DB_CONFIG, DB_CONFIG } from "../config";

const db = knex(TRAVCOM_DB_CONFIG);
const preAuthDB = knex(DB_CONFIG);


export const travComRouter = express.Router();

travComRouter.get("/ARInvoices", RequiresAuth, async function (req: Request, res: Response) {
  const result = await db("dbo.ARInvoicesNoHealth").select();
  res.status(200).json({ data: result });
});

travComRouter.get("/ARInvoices/:id", RequiresAuth, async function (req: Request, res: Response) {
  const result = await db("dbo.ARInvoicesNoHealth").where({ InvoiceID: req.params.id }).select();
  res.status(200).json({ data: result });
});

travComRouter.get("/ARInvoiceDetails", RequiresAuth, async function (req: Request, res: Response) {
  const result = await db("dbo.ARInvoiceDetailsNoHealth").select();
  res.status(200).json({ data: result });
});

travComRouter.get("/ARInvoiceDetails/:id", RequiresAuth, async function (req: Request, res: Response) {
  const result = await db("dbo.ARInvoiceDetailsNoHealth").where({ InvoiceID: req.params.id }).select();
  res.status(200).json({ data: result });
});

travComRouter.get("/segments", RequiresAuth, async function (req: Request, res: Response) {
  const result = await db("dbo.segmentsNoHealth").select();
  res.status(200).json({ data: result });
});

travComRouter.get("/segments/:id", RequiresAuth, async function (req: Request, res: Response) {
  const result = await db("dbo.segmentsNoHealth").where({ InvoiceID: req.params.id }).select();
  res.status(200).json({ data: result });
});

travComRouter.get("/itinerary/:InvoiceNumber", RequiresAuth, async function (req: Request, res: Response) {
  
  const InvoiceNumber = req.params.InvoiceNumber;  
  const invoice = await db("dbo.ARInvoicesNoHealth").where({ InvoiceNumber: InvoiceNumber }).select().first();
  const InvoiceID = invoice.InvoiceID;
  const details = await db("dbo.ARInvoiceDetailsNoHealth").where({ InvoiceID: InvoiceID }).select();  
  const unsortedSegments = await db("dbo.segmentsNoHealth").where({ InvoiceID: InvoiceID }).select();

  const segments = unsortedSegments.sort((a: any, b: any) => (a.DepartureInfo >= b.DepartureInfo ? 1 : -1));

  const result: {segments: any[]; remarks: string; totalCost: number} = { segments: [], remarks:'', totalCost:0};
  result.remarks = invoice.InvoiceRemarks;
  details.forEach((detail: any) => result.totalCost += Number(detail.GrossAmount));

  for(const segment of segments){
    const depAirport = airports.filter(airport => airport.iata_code==segment.DepartureCityCode)
    const arrAirport = airports.filter(airport => airport.iata_code==segment.ArrivalCityCode)
    const detail = details.filter((detail: any) => detail.InvoiceDetailID == segment.invoiceDetailID)
    
    result.segments.push({
      'flightNumber': segment.AirlineCode + Number(segment.FlightNumber),
      'departDate': segment.DepartureInfo,
      'departLocation': (depAirport[0]? depAirport[0].name:'')+' ('+segment.DepartureCityCode+')',
      'arriveDate': segment.ArrivalInfo,
      'arriveLocation': (arrAirport[0]? arrAirport[0].name:'')+' ('+segment.ArrivalCityCode+')',
      'class':segment.ClassOfService,
      'leg': segment.LegNumber,
      'ticketNumber': detail[0]? detail[0].TicketNumber: '',
      'passengerName':detail[0]? detail[0].PassengerName: ''
    })
  }

  res.status(200).json(result);
});


travComRouter.get("/flights/:start/:end", RequiresAuth, async function (req: Request, res: Response) {

  const startDate = req.params.start+'T00:00:00Z';
  const endDate = req.params.end+'T00:00:00Z';

  const invoices = await db("dbo.ARInvoicesNoHealth")
    .where('BookingDate', '>=', startDate)
    .where('BookingDate', '<=', endDate).select()
    
  const results: any[] = []
  let ctt=0
  for(const invoice of invoices){  
    const InvoiceID = invoice.InvoiceID
    //TODO Only 1000 records
    ctt++;
    if(ctt>1000) break;

    const details = await db("dbo.ARInvoiceDetailsNoHealth").where({ InvoiceID: InvoiceID }).select();    
    const unsortedSegments = await db("dbo.segmentsNoHealth").where({ InvoiceID: InvoiceID }).select();

    const segments = unsortedSegments.sort((a: any, b: any) => (a.DepartureInfo >= b.DepartureInfo ? 1 : -1));

    const detailedSegments: any = {}
    for(const segment of segments){
      if(!detailedSegments[segment.invoiceDetailID]) detailedSegments[segment.invoiceDetailID]=[]
      detailedSegments[segment.invoiceDetailID].push(segment)
    }
    
    const detail = details.filter((detail: any) => detail.ProductCode == 18)[0]
    const agent = detail? detail.VendorName : ''

    for(const invoiceDetailID of Object.keys(detailedSegments)){
      const invoiceDetail = details.filter((detail: any) => detail.InvoiceDetailID == invoiceDetailID)[0]
      if(!invoiceDetail) continue

      const flightInfo: string[] =[]
      let lastLegCity=''

      for(const segment of detailedSegments[invoiceDetailID]){        
        const arrAirport = airports.filter(airport => airport.iata_code==segment.ArrivalCityCode)
        lastLegCity = (arrAirport[0]?.municipality? arrAirport[0].municipality:'')
        const flight = segment.AirlineCode + Number(segment.FlightNumber) +' '+lastLegCity
        flightInfo.push(flight)
      }

      const flightReconcile = await preAuthDB("flightReconciliation").select("reconciled").where("invoiceDetailID", invoiceDetailID).first();

      const name = invoiceDetail.PassengerName.split('/').join(',').split(' ').join(',').split(',')
      
      const result = {
        invoiceDetailID: invoiceDetailID,
        invoiceID: InvoiceID,
        cost: invoiceDetail.SellingFare, 
        agent: agent, 
        purchaseDate: invoice.BookingDate, 
        airline: invoiceDetail.VendorName, 
        flightInfo: flightInfo.join(','), 
        finalDestination: lastLegCity, 
        dept: invoice.Department, 
        travelerFirstName: name[1], 
        travelerLastName: name[0], 
        reconciled: flightReconcile? flightReconcile.reconciled :false,
        reconcileID: flightReconcile? flightReconcile.reconcileID : null,
        reconcilePeriod: flightReconcile? flightReconcile.reconcilePeriod : null
      };

      results.push(result)
    }
  }

  res.status(200).json(results);
});


travComRouter.get("/statistics", RequiresAuth, async function (req: Request, res: Response) {

  const invoices = await db("dbo.ARInvoicesNoHealth").select()
  
  const results: any[] = []
  const statistics: any = {}

  for(const invoice of invoices){  
    const InvoiceID = invoice.InvoiceID
 
    const details = await db("dbo.ARInvoiceDetailsNoHealth").where({ InvoiceID: InvoiceID }).select();
    const unsortedSegments = await db("dbo.segmentsNoHealth").where({ InvoiceID: InvoiceID }).select();

    const segments = unsortedSegments.sort((a: any, b: any) => (a.DepartureInfo >= b.DepartureInfo ? 1 : -1));

    const lastInx = segments.length-1
    const departureCity = segments[0].DepartureCityCode ;
    const lastLegCity =  segments[lastInx].ArrivalCityCode;
    const departureDate = segments[0].DepartureInfo
    const lastLegDate = segments[lastInx].ArrivalInfo


    let totalExpenses = 0
    details.forEach((detail: any) => totalExpenses += Number(detail.SellingFare))

    let totalFlightCost = 0
    details.forEach((detail: any) => {if(detail.ProductCode==4 || detail.ProductCode==7 || detail.ProductCode==12 ) totalFlightCost += Number(detail.SellingFare)})

    const result = {
      dept: invoice.Department,
      totalFlightCost: totalFlightCost,
      totalExpenses: totalExpenses,
      finalDestinationCity: lastLegCity,       
      returnFlight: departureCity==lastLegCity,
      days: getDays(departureDate, lastLegDate) 
    };


    //_______STATISTICS_______
    const inx = result.dept+'/'+result.finalDestinationCity
    if(!statistics[inx]) statistics[inx] = {}
    statistics[inx].dept=result.dept
    statistics[inx].arrAirport=result.finalDestinationCity
    
    if(!statistics[inx].totalExpenses) statistics[inx].totalExpenses = 0
    statistics[inx].totalExpenses += totalExpenses
    
    if(!statistics[inx].totalFlightCost) statistics[inx].totalFlightCost = 0
    statistics[inx].totalFlightCost += totalFlightCost

    if(!statistics[inx].days) statistics[inx].days = 0
    statistics[inx].days += result.days

    if(!statistics[inx].totalTrips) statistics[inx].totalTrips = 0
    statistics[inx].totalTrips += 1

    if(!statistics[inx].totalRoundTrips) statistics[inx].totalRoundTrips = 0
    if(result.returnFlight) statistics[inx].totalRoundTrips += 1

    if(!statistics[inx].roundTripCost) statistics[inx].roundTripCost = 0
    if(result.returnFlight) statistics[inx].roundTripCost += totalFlightCost

  }

  const destinations = await preAuthDB("destinations").select("province", "city");

  for(const key of Object.keys(statistics)){
    const record = statistics[key]
    
    const arrAirport = airports.filter(airport => airport.iata_code==record.arrAirport)
    record.finalDestinationCity = (arrAirport[0]?.municipality? arrAirport[0].municipality:'')
    
    const destination = destinations.filter((dest: any) => dest.city.toLowerCase().trim()==record.finalDestinationCity.toLowerCase().trim())
    record.finalDestinationProvince = destination[0]? destination[0].province : (arrAirport[0]? arrAirport[0].iso_country:'')

    record.averageDurationDays = (record.days/record.totalTrips)
    record.averageExpensesPerDay = (record.totalExpenses/record.days)
    record.averageRoundTripFlightCost = (record.roundTripCost/record.totalRoundTrips)
    
    results.push(record)
  }

  res.status(200).json(results);
});

function getDays(departureDate: string, lastLegDate: string) {
  const start = new Date(departureDate);
  const end = new Date(lastLegDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays
}
