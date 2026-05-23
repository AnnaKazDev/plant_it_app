## Plant It - MP

### Glowny problem 
Jestem ogrodnikiem hobbystą. W swoim ogrodzie sadze wiele roślin. Sadzę je w róznych okresach (datach) i w róznych miejsacach (ogrodu) i etapach (z ziarenka, z sadzonki, do gruntu, do donic itd). Chcialabym miec aplikację, gdzie moge odznaczac sobie wszystkie akcje wraz ze zdjeciem z danej akcji. Chcialabym miec jedno miejsce, a wktorym moge obserwowac postepy wzrostu moich roslin (dostep do historii zdjęc i akcji) wraz z molziwoscia zaplanowania akcji na konkretną date.


### Najmniejszy zestaw funkconalnosci

#### Widok 1
LOGOWANIE I REJESTRACJA
- Logowanie i rejestracja
    1. Przy rejestracji user musi podać swoją lokalizację, aby móc czerpać dane dla pogody i faz księzyca

#### Widok 2
KARTA ROSLINY
- Manualne dodawanie rosliny wraz ze zdjeciem, nazwą
- Zdjecia dodawane sa z zasobow usera
- Do kazdej z roslin mozliwosc manualnego dodania: 
    1. akcji umieszczonej w dowolnej dacie (kalendarz)
    2. opisu tej akcji (wybór z defaultowych np.: -> posadzenie ziaren, posadzenie z sadzonki, podlanie, dodanie nawozu, obcięcie, atak ślimaków, atak mszyc itd) lub manualne wpisanie (max 300 znaków)
    3. Dodanie zdjęc
- Przy kazdej akcji będzie zaciągana i pokazywana informacja (na podstawie daty i wpisanej lokalizacji przy procesie rejestracji) o warunkach pogodowych - temperatura, deszcz, wiatr oraz fazach ksiezyca (pomocne przy planowaniu prac ogrodniczych)
- Bedzie mozliwosc planowania akcji ogrodniczych - np przy dodaniu daty wprzod - mozna zaplanowac podlanie lub przesadzenie danej rosliny
- W danej karcie rośliny bedzie pokazana historia poprzednich akcji (lista teaserów)

#### Widok 3 (widok defaultowy po zalogowaniu)
LISTA ROSLIN
- Widok listy roslin
    1. lista teaserow
    2. teaser przedstawia: zdjecie glowne rosliny, nazwe, opis ostatniej akcji, date, tempetarurę, deszcz, zachmurzenie faze ksiezyca z danej daty
    3. widoczne pokazanie nadchodzacych, zaplanowanych akcji
    4. input z opcja szukania - po nazwie rosliny, po akcji

#### Widok 4
KALENDARZ
- Widok kalendarza, gdzie pokazane są akcje dla wszystkich roslin
- Dla kazdego dnia pokazuja sie ikony dotyczace temperatury, naslonecznienia / zachmurzenia, deszczu oraz fazy ksiezyca
- Aplikacja bedzie laczyc sie z api pogodowym, gdzie na podstawie lokalizacji podanej podczas procesu rejestracji, bedzie wyswietlac potrzebne dane

### Co NIE wchodzi w zakres MVP
- Powiadomienia push o nadchodzacych akcjach
- Wspodzielenie kalendarzy miedzy userami
- Mapa, ktora przedstawia dany ogrod, gdzie mozna nanosic lokalizacje danej rosliny

### Kryteria sukcesu
- User bedzie dodawac wiecej niz 10 roslin oraz wiecej niz 5 akcji per dana roslina w roku