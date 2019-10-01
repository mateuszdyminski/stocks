package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	log "github.com/sirupsen/logrus"
)

var port = flag.String("port", "8080", "HTTP port number")

func main() {
	flag.Parse()

	router := mux.NewRouter()

	router.HandleFunc("/stocks", users).Methods("GET")
	router.HandleFunc("/stocks", user).Methods("POST")

	log.Fatal(http.ListenAndServe(":"+*port, Wrap(cors.Default().Handler(router))))
}

func users(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, allStocks)
}

func user(w http.ResponseWriter, r *http.Request) {
	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		WriteErr(w, errors.New("can't read request body"), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	pairs := strings.Split(string(data), "&")

	oid := ""
	for _, pair := range pairs {
		if strings.Contains(pair, "oid") {
			oid = strings.Split(pair, "=")[1]
		}
	}

	stock := allStocks[oid]
	if stock == nil {
		WriteErr(w, fmt.Errorf("can't find stock with oid: "+oid), http.StatusNotFound)
		return
	}

	resp := Resp{
		Data: []RespElem{RespElem{Stock: *stock}},
	}

	WriteJSON(w, resp)
}

type Resp struct {
	Data []RespElem `json:"data"`
}

type RespElem struct {
	Stock Stock `json:"symbol"`
}

type Stock struct {
	Oid         int     `json:"oid"`
	ShortName   string  `json:"shortName"`
	FullName    string  `json:"fullName"`
	O           float64 `json:"o"`
	C           float64 `json:"c"`
	Min         float64 `json:"min"`
	Max         float64 `json:"max"`
	V           int     `json:"v"`
	Mc          float64 `json:"mc"`
	Pc          float64 `json:"pc"`
	Tr          int     `json:"tr"`
	Lop         int     `json:"lop"`
	Ts          int64   `json:"ts"`
	MediumName  string  `json:"mediumName"`
	DisplayName string  `json:"displayName"`
	Ut          string  `json:"ut"`
	Ind         int     `json:"ind"`
	Qp          string  `json:"qp"`
}

func WriteJSON(w http.ResponseWriter, response interface{}) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json, err := json.Marshal(response)
	if err != nil {
		return err
	}

	if _, err := w.Write(json); err != nil {
		return err
	}

	return nil
}

func WriteErr(w http.ResponseWriter, err error, httpCode int) {
	log.Error(err.Error())

	// write error to response
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	var errMap = map[string]interface{}{
		"httpStatus": httpCode,
		"error":      err.Error(),
	}

	errJson, _ := json.Marshal(errMap)
	http.Error(w, string(errJson), httpCode)
}

func Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		begin := time.Now()
		interceptor := &interceptor{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(interceptor, r)
		var (
			status = strconv.Itoa(interceptor.statusCode)
			took   = time.Since(begin)
		)
		log.Infof("%s - %s %s %s %s %s Took: %s",
			getRemoteAddr(r),
			r.Method,
			r.RequestURI,
			r.Proto,
			status,
			r.UserAgent(),
			took.String())
	})
}

var invalidChars = regexp.MustCompile(`[^a-zA-Z0-9]+`)

type interceptor struct {
	http.ResponseWriter
	statusCode int
	recorded   bool
}

func (i *interceptor) WriteHeader(code int) {
	if !i.recorded {
		i.statusCode = code
		i.recorded = true
	}
	i.ResponseWriter.WriteHeader(code)
}

func (i *interceptor) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := i.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("interceptor: can't cast parent ResponseWriter to Hijacker")
	}
	return hj.Hijack()
}

func getRemoteAddr(r *http.Request) string {
	forwaredFor := r.Header.Get("X-Forwarded-For")
	if forwaredFor == "" {
		return r.RemoteAddr
	}

	return forwaredFor
}

var allStocks = map[string]*Stock{
	"9537": {
		Oid:         9537,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "LVC (LIVECHAT)",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"221": {
		Oid:         221,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "AMBRA",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"8789": {
		Oid:         8789,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "PKP Cargo",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"3972": {
		Oid:         3972,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "JSW",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"348": {
		Oid:         348,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "CCC",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"29136": {
		Oid:         29136,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "Orlen",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"41": {
		Oid:         41,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "PZU",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"308": {
		Oid:         308,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "Oponeo",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"17347": {
		Oid:         17347,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "Kruk",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"66": {
		Oid:         66,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "CDProject",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"3567": {
		Oid:         3567,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "11Bit",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"27169": {
		Oid:         27169,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "TenSquareGames",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"231": {
		Oid:         231,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "Tauron",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"5730": {
		Oid:         5730,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "Platige Image",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"149": {
		Oid:         149,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "Lena",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
	"9820": {
		Oid:         9820,
		ShortName:   "LVC",
		FullName:    "LIVECHAT SOFTWARE SPÓŁKA AKCYJNA",
		O:           35.5,
		C:           36.05,
		Min:         35.1,
		Max:         36.4,
		V:           12049,
		Mc:          429201.3,
		Pc:          36.75,
		Tr:          92,
		Lop:         0,
		Ts:          1569837932,
		MediumName:  "LIVECHAT",
		DisplayName: "PCC Rokita",
		Ut:          "LIVECHAT",
		Ind:         -1,
		Qp:          "2",
	},
}
